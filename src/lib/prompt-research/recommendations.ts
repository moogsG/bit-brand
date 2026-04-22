import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	aiPromptCitations,
	aiVisibilityPrompts,
	aiVisibilityPromptSets,
	clients,
	keywordResearch,
} from "@/lib/db/schema";
import { mapPromptsToKeywordCoverage } from "@/lib/prompt-research/gap-mapping";

export const PROMPT_RESEARCH_RECOMMENDATIONS_VERSION = "1.0.0" as const;

export type PromptResearchRecommendationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface PromptResearchRecommendation {
	id: string;
	title: string;
	priority: PromptResearchRecommendationPriority;
	rationale: string;
	action: string;
	evidence: {
		uncoveredPrompts?: number;
		uncoveredRate?: number;
		totalCitations?: number;
		topDomain?: string;
		topDomainShare?: number;
		staleCitationRate?: number;
		brandCitationShare?: number;
	};
}

export interface PromptResearchRecommendationsResult {
	version: typeof PROMPT_RESEARCH_RECOMMENDATIONS_VERSION;
	clientId: string;
	windowDays: number;
	startDate: string;
	promptSet: {
		id: string;
		name: string;
	} | null;
	totals: {
		totalPrompts: number;
		uncoveredPrompts: number;
		totalCitations: number;
		uniqueDomains: number;
	};
	recommendations: PromptResearchRecommendation[];
}

interface BuildPromptResearchRecommendationsParams {
	clientId: string;
	promptSetId?: string;
	windowDays?: 30 | 90;
	limit?: number;
}

function dateMinusDays(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

function normalizeDomain(domain: string): string {
	return (
		domain
			.trim()
			.toLowerCase()
			.replace(/^https?:\/\//, "")
			.replace(/^www\./, "")
			.split("/")[0] ?? ""
	);
}

function toPct(numerator: number, denominator: number): number {
	if (denominator <= 0) return 0;
	return Number((numerator / denominator).toFixed(4));
}

const priorityRank: Record<PromptResearchRecommendationPriority, number> = {
	HIGH: 3,
	MEDIUM: 2,
	LOW: 1,
};

export async function buildPromptResearchRecommendations({
	clientId,
	promptSetId,
	windowDays = 30,
	limit = 5,
}: BuildPromptResearchRecommendationsParams): Promise<PromptResearchRecommendationsResult> {
	const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
	const startDate = dateMinusDays(windowDays);

	const [clientRow, promptSet] = await Promise.all([
		db
			.select({ domain: clients.domain })
			.from(clients)
			.where(eq(clients.id, clientId))
			.get(),
		db
			.select({
				id: aiVisibilityPromptSets.id,
				name: aiVisibilityPromptSets.name,
			})
			.from(aiVisibilityPromptSets)
			.where(
				and(
					eq(aiVisibilityPromptSets.clientId, clientId),
					promptSetId
						? eq(aiVisibilityPromptSets.id, promptSetId)
						: eq(aiVisibilityPromptSets.isActive, true),
				),
			)
			.orderBy(desc(aiVisibilityPromptSets.updatedAt))
			.get(),
	]);

	if (!promptSet) {
		return {
			version: PROMPT_RESEARCH_RECOMMENDATIONS_VERSION,
			clientId,
			windowDays,
			startDate,
			promptSet: null,
			totals: {
				totalPrompts: 0,
				uncoveredPrompts: 0,
				totalCitations: 0,
				uniqueDomains: 0,
			},
			recommendations: [],
		};
	}

	const [prompts, keywords, citationRows] = await Promise.all([
		db
			.select({
				id: aiVisibilityPrompts.id,
				text: aiVisibilityPrompts.text,
				isActive: aiVisibilityPrompts.isActive,
			})
			.from(aiVisibilityPrompts)
			.where(eq(aiVisibilityPrompts.promptSetId, promptSet.id))
			.all(),
		db
			.select({
				id: keywordResearch.id,
				keyword: keywordResearch.keyword,
				priority: keywordResearch.priority,
				status: keywordResearch.status,
				targetUrl: keywordResearch.targetUrl,
				tags: keywordResearch.tags,
			})
			.from(keywordResearch)
			.where(eq(keywordResearch.clientId, clientId))
			.all(),
		db
			.select({
				domain: aiPromptCitations.domain,
				freshnessHint: aiPromptCitations.freshnessHint,
			})
			.from(aiPromptCitations)
			.where(
				and(
					eq(aiPromptCitations.clientId, clientId),
					gte(aiPromptCitations.date, startDate),
				),
			)
			.limit(5000)
			.all(),
	]);

	const coverage = mapPromptsToKeywordCoverage({
		prompts: prompts.map((prompt) => ({
			id: prompt.id,
			text: prompt.text,
			isActive: Boolean(prompt.isActive),
		})),
		keywords,
	});

	const totalPrompts = prompts.length;
	const uncoveredPrompts = coverage.uncovered.length;
	const uncoveredRate = toPct(uncoveredPrompts, totalPrompts);

	const domainCounts = new Map<string, number>();
	let staleCount = 0;
	for (const row of citationRows) {
		const normalized = normalizeDomain(row.domain);
		if (!normalized) continue;
		domainCounts.set(normalized, (domainCounts.get(normalized) ?? 0) + 1);
		if (row.freshnessHint === "STALE") staleCount += 1;
	}

	const sortedDomains = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]);
	const totalCitations = citationRows.length;
	const uniqueDomains = sortedDomains.length;
	const topDomain = sortedDomains[0]?.[0] ?? null;
	const topDomainCount = sortedDomains[0]?.[1] ?? 0;
	const topDomainShare = toPct(topDomainCount, totalCitations);
	const staleCitationRate = toPct(staleCount, totalCitations);

	const brandDomain = clientRow?.domain
		? normalizeDomain(clientRow.domain)
		: "";
	const brandCitationCount = brandDomain
		? (domainCounts.get(brandDomain) ?? 0)
		: 0;
	const brandCitationShare = toPct(brandCitationCount, totalCitations);

	const candidates: PromptResearchRecommendation[] = [];

	if (uncoveredPrompts > 0) {
		const priority: PromptResearchRecommendationPriority =
			uncoveredRate >= 0.5 ? "HIGH" : "MEDIUM";
		candidates.push({
			id: "close-prompt-coverage-gaps",
			title: "Close uncovered prompt intent gaps",
			priority,
			rationale: `${uncoveredPrompts} of ${totalPrompts} prompts are not mapped to keyword targets (coverage ${(uncoveredRate * 100).toFixed(0)}%).`,
			action:
				"Map each uncovered prompt to a target keyword and assign a supporting page update before the next reporting cycle.",
			evidence: {
				uncoveredPrompts,
				uncoveredRate,
			},
		});
	}

	if (totalCitations >= 8 && topDomain && topDomainShare >= 0.45) {
		const priority: PromptResearchRecommendationPriority =
			topDomainShare >= 0.6 ? "HIGH" : "MEDIUM";
		candidates.push({
			id: "diversify-citation-footprint",
			title: "Diversify citation footprint",
			priority,
			rationale: `${(topDomainShare * 100).toFixed(0)}% of citations cluster on ${topDomain}, which suggests over-reliance on a single source domain pattern.`,
			action:
				"Prioritize content updates that can attract citations from at least 2 additional authoritative domains in this topic cluster.",
			evidence: {
				totalCitations,
				topDomain,
				topDomainShare,
			},
		});
	}

	if (totalCitations >= 8 && staleCitationRate >= 0.35) {
		const priority: PromptResearchRecommendationPriority =
			staleCitationRate >= 0.5 ? "HIGH" : "MEDIUM";
		candidates.push({
			id: "refresh-stale-evidence",
			title: "Refresh stale supporting evidence",
			priority,
			rationale: `${(staleCitationRate * 100).toFixed(0)}% of observed citations appear stale, which can reduce trust in AI-generated answers for fast-moving topics.`,
			action:
				"Update priority pages with current-year proof points, then align prompts to reference those refreshed assets.",
			evidence: {
				totalCitations,
				staleCitationRate,
			},
		});
	}

	if (totalCitations >= 10 && brandDomain && brandCitationShare < 0.2) {
		candidates.push({
			id: "increase-first-party-presence",
			title: "Increase first-party citation presence",
			priority: "MEDIUM",
			rationale: `Only ${(brandCitationShare * 100).toFixed(0)}% of citations are from ${brandDomain}, indicating weak first-party citation pickup.`,
			action:
				"Strengthen entity and evidence signals on core pages so first-party domains are cited more often for high-intent prompts.",
			evidence: {
				totalCitations,
				brandCitationShare,
			},
		});
	}

	if (candidates.length === 0) {
		candidates.push({
			id: "monitor-and-iterate",
			title: "Maintain monitoring loop",
			priority: "LOW",
			rationale:
				"Current prompt coverage and citation patterns do not trigger high-priority gaps; continue incremental improvements.",
			action:
				"Review prompt coverage and citation mix weekly, then promote only statistically meaningful changes into strategy updates.",
			evidence: {
				uncoveredPrompts,
				uncoveredRate,
				totalCitations,
			},
		});
	}

	const recommendations = candidates
		.sort((a, b) => {
			const byPriority = priorityRank[b.priority] - priorityRank[a.priority];
			if (byPriority !== 0) return byPriority;
			return a.id.localeCompare(b.id);
		})
		.slice(0, safeLimit);

	return {
		version: PROMPT_RESEARCH_RECOMMENDATIONS_VERSION,
		clientId,
		windowDays,
		startDate,
		promptSet: { id: promptSet.id, name: promptSet.name },
		totals: {
			totalPrompts,
			uncoveredPrompts,
			totalCitations,
			uniqueDomains,
		},
		recommendations,
	};
}
