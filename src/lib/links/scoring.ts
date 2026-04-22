export interface LinkProspectScoringInput {
	relevanceScore?: number | null;
	authorityScore?: number | null;
	trafficScore?: number | null;
	relationshipScore?: number | null;
}

export interface LinkProspectScoreBreakdown {
	relevance: number;
	authority: number;
	traffic: number;
	relationship: number;
	weights: {
		relevance: number;
		authority: number;
		traffic: number;
		relationship: number;
	};
	weighted: {
		relevance: number;
		authority: number;
		traffic: number;
		relationship: number;
	};
}

export interface LinkProspectScoreResult {
	score: number;
	breakdown: LinkProspectScoreBreakdown;
}

const SCORE_WEIGHTS = {
	relevance: 0.45,
	authority: 0.35,
	traffic: 0.1,
	relationship: 0.1,
} as const;

function normalizeScore(value: number | null | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return 0;
	}

	if (value < 0) {
		return 0;
	}

	if (value > 100) {
		return 100;
	}

	return Math.round(value);
}

export function computeLinkProspectScore(
	input: LinkProspectScoringInput,
): LinkProspectScoreResult {
	const relevance = normalizeScore(input.relevanceScore);
	const authority = normalizeScore(input.authorityScore);
	const traffic = normalizeScore(input.trafficScore);
	const relationship = normalizeScore(input.relationshipScore);

	const weighted = {
		relevance: Math.round(relevance * SCORE_WEIGHTS.relevance),
		authority: Math.round(authority * SCORE_WEIGHTS.authority),
		traffic: Math.round(traffic * SCORE_WEIGHTS.traffic),
		relationship: Math.round(relationship * SCORE_WEIGHTS.relationship),
	};

	const score = normalizeScore(
		weighted.relevance +
			weighted.authority +
			weighted.traffic +
			weighted.relationship,
	);

	return {
		score,
		breakdown: {
			relevance,
			authority,
			traffic,
			relationship,
			weights: SCORE_WEIGHTS,
			weighted,
		},
	};
}
