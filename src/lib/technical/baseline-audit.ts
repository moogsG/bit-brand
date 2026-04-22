import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	type TechnicalIssueSeverity,
	type TechnicalIssueType,
	technicalAuditRuns,
	technicalIssues,
} from "@/lib/db/schema";
import { scoreTechnicalIssue } from "@/lib/technical/prioritization";

const MAX_SEED_URLS = 5;
const MAX_INTERNAL_LINK_CHECKS_PER_PAGE = 8;
const PAGE_FETCH_TIMEOUT_MS = 5_000;
const LINK_FETCH_TIMEOUT_MS = 3_500;

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

interface PendingIssue {
	url: string;
	issueType: TechnicalIssueType;
	severity: TechnicalIssueSeverity;
	message: string;
	details?: Record<string, unknown>;
}

interface ParsedPageResult {
	issues: PendingIssue[];
	internalLinks: string[];
}

export interface RunTechnicalBaselineAuditInput {
	clientId: string;
	clientDomain: string;
	seedUrls?: string[];
	triggeredByUserId: string;
}

export interface RunTechnicalBaselineAuditResult {
	run: typeof technicalAuditRuns.$inferSelect;
	issues: (typeof technicalIssues.$inferSelect)[];
	urlsCrawled: string[];
}

function isPrivateIpv4(hostname: string): boolean {
	if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
		return false;
	}

	const [a, b] = hostname.split(".").map((part) => Number.parseInt(part, 10));
	if (a === 10 || a === 127) {
		return true;
	}
	if (a === 192 && b === 168) {
		return true;
	}
	if (a === 172 && b >= 16 && b <= 31) {
		return true;
	}

	return false;
}

function isSafeHostname(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith(".local")) {
		return false;
	}

	if (isPrivateIpv4(lower)) {
		return false;
	}

	return true;
}

function normalizeClientHomepage(domain: string): string {
	const candidate =
		domain.startsWith("http://") || domain.startsWith("https://")
			? domain
			: `https://${domain}`;
	const parsed = new URL(candidate);
	return `${parsed.origin}/`;
}

function normalizeSeedUrl(
	candidate: string,
	fallbackBaseUrl: string,
): string | null {
	const trimmed = candidate.trim();
	if (!trimmed) {
		return null;
	}

	let parsed: URL;
	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		parsed = new URL(trimmed);
	} else if (trimmed.startsWith("/")) {
		parsed = new URL(trimmed, fallbackBaseUrl);
	} else {
		parsed = new URL(`https://${trimmed}`);
	}

	if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
		return null;
	}

	if (!isSafeHostname(parsed.hostname)) {
		return null;
	}

	parsed.hash = "";
	return parsed.toString();
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs: number,
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, {
			...init,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

function extractTitle(html: string): string | null {
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (!match) {
		return null;
	}

	const value = match[1].replace(/\s+/g, " ").trim();
	return value.length > 0 ? value : null;
}

function extractMetaDescription(html: string): string | null {
	const patterns = [
		/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
		/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i,
	];

	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match && match[1]) {
			const value = match[1].replace(/\s+/g, " ").trim();
			if (value.length > 0) {
				return value;
			}
		}
	}

	return null;
}

function extractCanonical(html: string): string | null {
	const patterns = [
		/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i,
		/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i,
	];

	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match && match[1]) {
			const value = match[1].trim();
			if (value.length > 0) {
				return value;
			}
		}
	}

	return null;
}

function hasSchemaMarkup(html: string): boolean {
	return /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html);
}

function extractInternalLinks(pageUrl: string, html: string): string[] {
	const page = new URL(pageUrl);
	const links = new Set<string>();
	const hrefRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;

	for (const match of html.matchAll(hrefRegex)) {
		const href = match[1]?.trim();
		if (
			!href ||
			href.startsWith("#") ||
			href.startsWith("mailto:") ||
			href.startsWith("tel:")
		) {
			continue;
		}

		try {
			const resolved = new URL(href, pageUrl);
			if (!(resolved.protocol === "http:" || resolved.protocol === "https:")) {
				continue;
			}
			if (resolved.origin !== page.origin) {
				continue;
			}
			resolved.hash = "";
			links.add(resolved.toString());
			if (links.size >= MAX_INTERNAL_LINK_CHECKS_PER_PAGE) {
				break;
			}
		} catch {}
	}

	return [...links].sort((a, b) => a.localeCompare(b));
}

function analyzePage(url: string, html: string): ParsedPageResult {
	const issues: PendingIssue[] = [];

	const title = extractTitle(html);
	if (!title) {
		issues.push({
			url,
			issueType: "MISSING_TITLE",
			severity: "CRITICAL",
			message: "Missing <title> tag",
		});
	} else if (title.length > 60) {
		issues.push({
			url,
			issueType: "TITLE_TOO_LONG",
			severity: "WARNING",
			message: "Title is longer than 60 characters",
			details: { length: title.length, title },
		});
	}

	const metaDescription = extractMetaDescription(html);
	if (!metaDescription) {
		issues.push({
			url,
			issueType: "MISSING_META_DESCRIPTION",
			severity: "WARNING",
			message: "Missing meta description",
		});
	} else if (metaDescription.length > 160) {
		issues.push({
			url,
			issueType: "META_DESCRIPTION_TOO_LONG",
			severity: "INFO",
			message: "Meta description is longer than 160 characters",
			details: { length: metaDescription.length },
		});
	}

	const canonical = extractCanonical(html);
	if (!canonical) {
		issues.push({
			url,
			issueType: "MISSING_CANONICAL",
			severity: "WARNING",
			message: "Missing canonical tag",
		});
	} else {
		try {
			const canonicalUrl = new URL(canonical, url).toString();
			const currentUrl = new URL(url).toString();
			if (canonicalUrl !== currentUrl) {
				issues.push({
					url,
					issueType: "CANONICAL_MISMATCH",
					severity: "INFO",
					message: "Canonical URL differs from crawled URL",
					details: { canonicalUrl, currentUrl },
				});
			}
		} catch {
			issues.push({
				url,
				issueType: "CANONICAL_MISMATCH",
				severity: "INFO",
				message: "Canonical URL could not be parsed",
				details: { canonical },
			});
		}
	}

	if (!hasSchemaMarkup(html)) {
		issues.push({
			url,
			issueType: "MISSING_SCHEMA",
			severity: "WARNING",
			message: "No JSON-LD schema markup detected",
		});
	}

	return {
		issues,
		internalLinks: extractInternalLinks(url, html),
	};
}

async function checkBrokenLinks(
	pageUrl: string,
	links: string[],
): Promise<PendingIssue[]> {
	const issues: PendingIssue[] = [];

	for (const link of links) {
		try {
			let response = await fetchWithTimeout(
				link,
				{
					method: "HEAD",
					redirect: "follow",
					headers: {
						"user-agent": "bit-brand-technical-baseline/1.0",
					},
				},
				LINK_FETCH_TIMEOUT_MS,
			);

			if (response.status === 405 || response.status === 501) {
				response = await fetchWithTimeout(
					link,
					{
						method: "GET",
						redirect: "follow",
						headers: {
							"user-agent": "bit-brand-technical-baseline/1.0",
						},
					},
					LINK_FETCH_TIMEOUT_MS,
				);
			}

			if (response.status >= 400) {
				issues.push({
					url: pageUrl,
					issueType: "BROKEN_LINK",
					severity: "WARNING",
					message: `Broken internal link detected (${response.status})`,
					details: { link, status: response.status },
				});
			}
		} catch (error) {
			issues.push({
				url: pageUrl,
				issueType: "BROKEN_LINK",
				severity: "WARNING",
				message: "Broken internal link detected (request failed)",
				details: {
					link,
					error: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	return issues;
}

export async function runTechnicalBaselineAudit(
	input: RunTechnicalBaselineAuditInput,
): Promise<RunTechnicalBaselineAuditResult> {
	const fallbackHomepage = normalizeClientHomepage(input.clientDomain);
	const requestedUrls =
		input.seedUrls && input.seedUrls.length > 0
			? input.seedUrls
			: [fallbackHomepage];

	const normalizedUrls = [
		...new Set(
			requestedUrls
				.map((url) => normalizeSeedUrl(url, fallbackHomepage))
				.filter((url): url is string => Boolean(url)),
		),
	]
		.slice(0, MAX_SEED_URLS)
		.sort((a, b) => a.localeCompare(b));

	const [run] = await db
		.insert(technicalAuditRuns)
		.values({
			clientId: input.clientId,
			status: "RUNNING",
			seedUrls: JSON.stringify(normalizedUrls),
			triggeredBy: input.triggeredByUserId,
		})
		.returning();

	if (!run) {
		throw new Error("Failed to create technical audit run");
	}

	const pendingIssues: PendingIssue[] = [];
	let pagesCrawled = 0;
	let fetchFailures = 0;

	if (normalizedUrls.length === 0) {
		pendingIssues.push({
			url: fallbackHomepage,
			issueType: "FETCH_ERROR",
			severity: "CRITICAL",
			message: "No valid and safe URLs were provided for crawl",
		});
	}

	for (const url of normalizedUrls) {
		try {
			const response = await fetchWithTimeout(
				url,
				{
					method: "GET",
					redirect: "follow",
					headers: {
						"user-agent": "bit-brand-technical-baseline/1.0",
						accept: "text/html,application/xhtml+xml",
					},
				},
				PAGE_FETCH_TIMEOUT_MS,
			);

			if (!response.ok) {
				fetchFailures += 1;
				pendingIssues.push({
					url,
					issueType: "FETCH_ERROR",
					severity: "CRITICAL",
					message: `Failed to fetch page (${response.status})`,
					details: { status: response.status },
				});
				continue;
			}

			const contentType =
				response.headers.get("content-type")?.toLowerCase() ?? "";
			if (!contentType.includes("text/html")) {
				fetchFailures += 1;
				pendingIssues.push({
					url,
					issueType: "FETCH_ERROR",
					severity: "WARNING",
					message: "Fetched resource is not HTML",
					details: { contentType },
				});
				continue;
			}

			const html = await response.text();
			pagesCrawled += 1;

			const parsed = analyzePage(url, html);
			pendingIssues.push(...parsed.issues);
			const brokenLinkIssues = await checkBrokenLinks(
				url,
				parsed.internalLinks,
			);
			pendingIssues.push(...brokenLinkIssues);
		} catch (error) {
			fetchFailures += 1;
			pendingIssues.push({
				url,
				issueType: "FETCH_ERROR",
				severity: "CRITICAL",
				message: "Failed to fetch page (request error)",
				details: {
					error: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	const insertedIssues =
		pendingIssues.length > 0
			? await db
					.insert(technicalIssues)
					.values(
						pendingIssues.map((issue) => {
							const priority = scoreTechnicalIssue({
								issueType: issue.issueType,
								severity: issue.severity,
								details: issue.details,
							});

							return {
								runId: run.id,
								clientId: input.clientId,
								url: issue.url,
								issueType: issue.issueType,
								severity: issue.severity,
								message: issue.message,
								details: JSON.stringify(issue.details ?? {}),
								priorityScore: priority.priorityScore,
								priorityBand: priority.priorityBand,
								proposable: priority.proposable,
								proposableRationale: priority.proposableRationale,
							};
						}),
					)
					.returning()
			: [];

	const status =
		pagesCrawled === 0 ? "FAILED" : fetchFailures > 0 ? "PARTIAL" : "SUCCESS";

	await db
		.update(technicalAuditRuns)
		.set({
			status,
			pagesCrawled,
			issuesFound: insertedIssues.length,
			completedAt: new Date(),
			error: status === "FAILED" ? "No pages were successfully crawled" : null,
		})
		.where(eq(technicalAuditRuns.id, run.id))
		.run();

	const updatedRun = await db
		.select()
		.from(technicalAuditRuns)
		.where(eq(technicalAuditRuns.id, run.id))
		.get();

	if (!updatedRun) {
		throw new Error("Failed to load updated technical audit run");
	}

	return {
		run: updatedRun,
		issues: insertedIssues,
		urlsCrawled: normalizedUrls,
	};
}
