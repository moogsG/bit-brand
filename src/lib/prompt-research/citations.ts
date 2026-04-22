import { z } from "zod";

export const citationContentTypeSchema = z.enum([
	"ARTICLE",
	"HOMEPAGE",
	"DOCS",
	"VIDEO",
	"FORUM",
	"DIRECTORY",
	"UNKNOWN",
]);

export type CitationContentType = z.infer<typeof citationContentTypeSchema>;

export const citationFreshnessHintSchema = z.enum([
	"FRESH",
	"STALE",
	"UNKNOWN",
]);

export type CitationFreshnessHint = z.infer<typeof citationFreshnessHintSchema>;

export interface CitationCandidate {
	domain: string;
	url: string | null;
	title: string | null;
	contentType: CitationContentType;
	freshnessHint: CitationFreshnessHint;
}

export function normalizeDomain(input: string): string {
	const trimmed = input.trim().toLowerCase();
	const withoutScheme = trimmed.replace(/^https?:\/\//, "");
	const withoutPath = withoutScheme.split("/")[0] ?? "";
	const withoutPort = withoutPath.split(":")[0] ?? "";
	return withoutPort.replace(/^www\./, "");
}

const urlRegex =
	/https?:\/\/(?:www\.)?([a-z0-9\-._~%]+\.[a-z]{2,})(?:\/[^\s)\]]*)?/gi;

const domainRegex =
	/\b(?:www\.)?([a-z0-9\-._~%]+\.[a-z]{2,})\b/gi;

export function extractDomainsAndUrls(text: string): Array<{ domain: string; url: string | null }> {
	const seen = new Set<string>();
	const out: Array<{ domain: string; url: string | null }> = [];

	const push = (domainRaw: string, url: string | null) => {
		const domain = normalizeDomain(domainRaw);
		if (!domain) return;
		const key = `${domain}|${url ?? ""}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push({ domain, url });
	};

	for (const match of text.matchAll(urlRegex)) {
		const domain = match[1];
		const url = match[0];
		if (domain) push(domain, url);
	}

	// Fallback: domains without scheme.
	for (const match of text.matchAll(domainRegex)) {
		const domain = match[1];
		if (domain) push(domain, null);
	}

	return out;
}

export function inferContentType(url: string | null, domain: string): CitationContentType {
	const d = domain.toLowerCase();
	const u = (url ?? "").toLowerCase();
	if (d.includes("youtube.com") || d.includes("youtu.be") || u.includes("/watch")) {
		return "VIDEO";
	}
	if (u.includes("/docs") || u.includes("/documentation") || d.includes("developer")) {
		return "DOCS";
	}
	if (u.includes("/forum") || d.includes("reddit.com") || d.includes("stackexchange")) {
		return "FORUM";
	}
	if (u.includes("/directory") || d.includes("yelp") || d.includes("yellowpages")) {
		return "DIRECTORY";
	}
	if (!url || url === null) {
		return "UNKNOWN";
	}
	try {
		const parsed = new URL(url);
		if (parsed.pathname === "/" || parsed.pathname === "") return "HOMEPAGE";
		if (parsed.pathname.includes("/blog") || parsed.pathname.includes("/posts")) {
			return "ARTICLE";
		}
		return "ARTICLE";
	} catch {
		return "UNKNOWN";
	}
}

export function inferFreshnessHint(text: string): CitationFreshnessHint {
	const lower = text.toLowerCase();
	const yearMatch = lower.match(/\b(20\d{2})\b/);
	const currentYear = new Date().getUTCFullYear();
	if (yearMatch) {
		const year = Number.parseInt(yearMatch[1] ?? "0", 10);
		if (Number.isFinite(year) && year >= currentYear - 1) return "FRESH";
		if (Number.isFinite(year) && year <= currentYear - 3) return "STALE";
	}
	if (lower.includes("updated") || lower.includes("last updated")) return "FRESH";
	return "UNKNOWN";
}

export function parseCitationCandidates(args: {
	citationDomain?: string | null;
	citationSnippet?: string | null;
	responseSnippet?: string | null;
}): CitationCandidate[] {
	const text =
		[args.citationSnippet, args.responseSnippet].filter(Boolean).join("\n") || "";

	const items: Array<{ domain: string; url: string | null }> = [];
	if (args.citationDomain) {
		items.push({ domain: normalizeDomain(args.citationDomain), url: null });
	}
	items.push(...extractDomainsAndUrls(text));

	const out: CitationCandidate[] = [];
	const seen = new Set<string>();
	for (const item of items) {
		const domain = normalizeDomain(item.domain);
		if (!domain) continue;
		const key = `${domain}|${item.url ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			domain,
			url: item.url,
			title: null,
			contentType: inferContentType(item.url, domain),
			freshnessHint: inferFreshnessHint(text),
		});
	}

	return out;
}
