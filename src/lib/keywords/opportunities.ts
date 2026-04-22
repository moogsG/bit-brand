import type { KeywordResearch } from "@/lib/db/schema";

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"for",
	"from",
	"how",
	"in",
	"is",
	"it",
	"of",
	"on",
	"or",
	"the",
	"to",
	"with",
]);

const STATUS_BOOST: Record<NonNullable<KeywordResearch["status"]>, number> = {
	OPPORTUNITY: 10,
	TARGETING: 6,
	RANKING: 3,
	WON: 0,
};

const PRIORITY_BOOST: Record<
	NonNullable<KeywordResearch["priority"]>,
	number
> = {
	HIGH: 5,
	MEDIUM: 3,
	LOW: 1,
};

const INTENT_BOOST: Record<NonNullable<KeywordResearch["intent"]>, number> = {
	TRANSACTIONAL: 5,
	COMMERCIAL: 4,
	NAVIGATIONAL: 2,
	INFORMATIONAL: 2,
};

const CLUSTER_TOKEN_LIMIT = 2;

export interface OpportunityScoreBreakdown {
	volume: number;
	difficulty: number;
	rankGap: number;
	status: number;
	priority: number;
	intent: number;
}

export interface KeywordOpportunity {
	id: string;
	keyword: string;
	monthlyVolume: number | null;
	difficulty: number | null;
	currentPosition: number | null;
	targetPosition: number | null;
	status: KeywordResearch["status"];
	priority: KeywordResearch["priority"];
	intent: KeywordResearch["intent"];
	opportunityScore: number;
	scoreBreakdown: OpportunityScoreBreakdown;
	clusterKey: string;
}

export interface KeywordOpportunityCluster {
	clusterKey: string;
	label: string;
	size: number;
	avgOpportunityScore: number;
	topKeywords: string[];
	keywordIds: string[];
}

export interface KeywordOpportunityResult {
	opportunities: KeywordOpportunity[];
	clusters: KeywordOpportunityCluster[];
	meta: {
		totalKeywords: number;
		returnedKeywords: number;
		totalClusters: number;
	};
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function normalizeToken(token: string): string {
	const lower = token.toLowerCase();
	if (lower.length > 4 && lower.endsWith("ing")) {
		return lower.slice(0, -3);
	}
	if (lower.length > 3 && lower.endsWith("es")) {
		return lower.slice(0, -2);
	}
	if (lower.length > 2 && lower.endsWith("s")) {
		return lower.slice(0, -1);
	}
	return lower;
}

function tokenizeKeyword(keyword: string): string[] {
	return keyword
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.map((token) => normalizeToken(token.trim()))
		.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildClusterKey(keyword: string): string {
	const tokens = tokenizeKeyword(keyword);
	if (tokens.length === 0) {
		return "uncategorized";
	}

	return tokens.slice(0, CLUSTER_TOKEN_LIMIT).join(" ");
}

function toClusterLabel(clusterKey: string): string {
	if (clusterKey === "uncategorized") {
		return "Uncategorized";
	}

	return clusterKey
		.split(" ")
		.map((part) => part[0]?.toUpperCase() + part.slice(1))
		.join(" ");
}

function toOpportunity(
	keyword: KeywordResearch,
	maxVolume: number,
): KeywordOpportunity {
	const volumeValue = Math.max(keyword.monthlyVolume ?? 0, 0);
	const normalizedVolume =
		maxVolume <= 0
			? 0
			: Math.log1p(volumeValue) / Math.log1p(Math.max(maxVolume, 1));
	const volumeScore = normalizedVolume * 35;

	const difficulty = clamp(keyword.difficulty ?? 55, 0, 100);
	const difficultyScore = ((100 - difficulty) / 100) * 22;

	const currentPosition = keyword.currentPosition ?? 100;
	const targetPosition = keyword.targetPosition ?? 10;
	const rankGap = Math.max(currentPosition - targetPosition, 0);
	const rankGapScore = (Math.min(rankGap, 40) / 40) * 18;

	const statusScore = STATUS_BOOST[keyword.status ?? "OPPORTUNITY"];
	const priorityScore = PRIORITY_BOOST[keyword.priority ?? "MEDIUM"];
	const intentScore = keyword.intent ? INTENT_BOOST[keyword.intent] : 2;

	const rawScore =
		volumeScore +
		difficultyScore +
		rankGapScore +
		statusScore +
		priorityScore +
		intentScore;
	const opportunityScore = Math.round(clamp(rawScore, 0, 100));

	return {
		id: keyword.id,
		keyword: keyword.keyword,
		monthlyVolume: keyword.monthlyVolume ?? null,
		difficulty: keyword.difficulty ?? null,
		currentPosition: keyword.currentPosition ?? null,
		targetPosition: keyword.targetPosition ?? null,
		status: keyword.status,
		priority: keyword.priority,
		intent: keyword.intent,
		opportunityScore,
		scoreBreakdown: {
			volume: Math.round(volumeScore),
			difficulty: Math.round(difficultyScore),
			rankGap: Math.round(rankGapScore),
			status: statusScore,
			priority: priorityScore,
			intent: intentScore,
		},
		clusterKey: buildClusterKey(keyword.keyword),
	};
}

function buildClusters(
	opportunities: KeywordOpportunity[],
): KeywordOpportunityCluster[] {
	const groups = new Map<string, KeywordOpportunity[]>();

	for (const opportunity of opportunities) {
		const list = groups.get(opportunity.clusterKey) ?? [];
		list.push(opportunity);
		groups.set(opportunity.clusterKey, list);
	}

	return [...groups.entries()]
		.map(([clusterKey, items]) => {
			const sortedItems = [...items].sort((a, b) => {
				if (b.opportunityScore !== a.opportunityScore) {
					return b.opportunityScore - a.opportunityScore;
				}
				return a.keyword.localeCompare(b.keyword);
			});

			const average =
				sortedItems.reduce((sum, item) => sum + item.opportunityScore, 0) /
				sortedItems.length;

			return {
				clusterKey,
				label: toClusterLabel(clusterKey),
				size: sortedItems.length,
				avgOpportunityScore: Math.round(average),
				topKeywords: sortedItems.slice(0, 3).map((item) => item.keyword),
				keywordIds: sortedItems.map((item) => item.id),
			} satisfies KeywordOpportunityCluster;
		})
		.sort((a, b) => {
			if (b.size !== a.size) {
				return b.size - a.size;
			}
			if (b.avgOpportunityScore !== a.avgOpportunityScore) {
				return b.avgOpportunityScore - a.avgOpportunityScore;
			}
			return a.clusterKey.localeCompare(b.clusterKey);
		});
}

export function scoreKeywordOpportunities(
	keywords: KeywordResearch[],
	limit = 100,
): KeywordOpportunityResult {
	const safeLimit = clamp(Math.floor(limit), 1, 200);
	const maxVolume = Math.max(
		0,
		...keywords.map((keyword) => Math.max(keyword.monthlyVolume ?? 0, 0)),
	);

	const opportunities = keywords
		.map((keyword) => toOpportunity(keyword, maxVolume))
		.sort((a, b) => {
			if (b.opportunityScore !== a.opportunityScore) {
				return b.opportunityScore - a.opportunityScore;
			}
			return a.keyword.localeCompare(b.keyword);
		})
		.slice(0, safeLimit);

	const clusters = buildClusters(opportunities);

	return {
		opportunities,
		clusters,
		meta: {
			totalKeywords: keywords.length,
			returnedKeywords: opportunities.length,
			totalClusters: clusters.length,
		},
	};
}
