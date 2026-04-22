const HEALTH_SCORE_MIN = 0;
const HEALTH_SCORE_MAX = 100;

const DEFAULT_TOTAL_EXPECTED_SOURCES = 5;
const DEFAULT_CONTENT_FRESHNESS_SCORE = 55;
const TECHNICAL_STALE_DAYS = 14;

const TECHNICAL_WEIGHT = 0.45;
const CONTENT_FRESHNESS_WEIGHT = 0.25;
const ACTIVE_ISSUES_WEIGHT = 0.3;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface TechnicalHealthInput {
	connectedSources?: number;
	totalExpectedSources?: number;
	staleSources?: number;
	errorSources?: number;
}

export interface ContentFreshnessHealthInput {
	lastUpdatedAt?: Date | number | null;
}

export interface ActiveIssuesHealthInput {
	blockedTasks?: number;
	urgentTasks?: number;
	pendingApprovals?: number;
	unreadClientMessages?: number;
}

export interface HealthScoreInput {
	technical?: TechnicalHealthInput;
	contentFreshness?: ContentFreshnessHealthInput;
	activeIssues?: ActiveIssuesHealthInput;
}

export interface HealthScoreComponent {
	score: number;
	weight: number;
	weightedContribution: number;
	factors: Record<string, number | string | boolean | null>;
}

export interface HealthScoreResult {
	overallScore: number;
	status: "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL";
	breakdown: {
		technical: HealthScoreComponent;
		contentFreshness: HealthScoreComponent;
		activeIssues: HealthScoreComponent;
	};
	reasons: string[];
}

export interface HealthScoreOptions {
	asOf?: Date;
}

function clampScore(value: number): number {
	if (Number.isNaN(value)) {
		return HEALTH_SCORE_MIN;
	}

	return Math.min(HEALTH_SCORE_MAX, Math.max(HEALTH_SCORE_MIN, Math.round(value)));
}

function normalizeCount(value: number | undefined): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.max(0, Math.floor(value as number));
}

function normalizeDate(value: Date | number | null | undefined): Date | null {
	if (value === null || value === undefined) {
		return null;
	}

	const normalized = value instanceof Date ? value : new Date(value);
 return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function classifyStatus(score: number): HealthScoreResult["status"] {
	if (score >= 80) {
		return "HEALTHY";
	}

	if (score >= 65) {
		return "WATCH";
	}

	if (score >= 45) {
		return "AT_RISK";
	}

	return "CRITICAL";
}

function calculateTechnicalScore(
	input: TechnicalHealthInput,
	asOf: Date,
): HealthScoreComponent {
	const connectedSources = normalizeCount(input.connectedSources);
	const totalExpectedSources = Math.max(
		1,
		normalizeCount(input.totalExpectedSources) || DEFAULT_TOTAL_EXPECTED_SOURCES,
	);
	const staleSources = Math.min(
		connectedSources,
		normalizeCount(input.staleSources),
	);
	const errorSources = Math.min(
		connectedSources,
		normalizeCount(input.errorSources),
	);

	const coverageScore = (connectedSources / totalExpectedSources) * 100;
	const healthyConnectedSources = Math.max(
		0,
		connectedSources - staleSources - errorSources,
	);
	const freshnessScore =
		connectedSources === 0
			? 50
			: (healthyConnectedSources / connectedSources) * 100;
	const errorPenalty = Math.min(errorSources * 12, 36);

	const score = clampScore(
		coverageScore * 0.55 + freshnessScore * 0.45 - errorPenalty,
	);

	const staleCutoffDate = new Date(asOf.getTime() - TECHNICAL_STALE_DAYS * DAY_IN_MS)
		.toISOString()
		.slice(0, 10);

	return {
		score,
		weight: TECHNICAL_WEIGHT,
		weightedContribution: Number((score * TECHNICAL_WEIGHT).toFixed(2)),
		factors: {
			connectedSources,
			totalExpectedSources,
			coverageScore: Number(coverageScore.toFixed(2)),
			staleSources,
			errorSources,
			healthyConnectedSources,
			freshnessScore: Number(freshnessScore.toFixed(2)),
			errorPenalty,
			staleThresholdDays: TECHNICAL_STALE_DAYS,
			staleCutoffDate,
		},
	};
}

function getFreshnessBand(daysSinceUpdate: number | null): string {
	if (daysSinceUpdate === null) {
		return "UNKNOWN";
	}

	if (daysSinceUpdate <= 30) {
		return "VERY_FRESH";
	}

	if (daysSinceUpdate <= 60) {
		return "FRESH";
	}

	if (daysSinceUpdate <= 90) {
		return "STALE_SOON";
	}

	if (daysSinceUpdate <= 120) {
		return "STALE";
	}

	if (daysSinceUpdate <= 180) {
		return "OLD";
	}

	return "VERY_OLD";
}

function calculateContentFreshnessScore(
	input: ContentFreshnessHealthInput,
	asOf: Date,
): HealthScoreComponent {
	const lastUpdatedAt = normalizeDate(input.lastUpdatedAt);

	if (!lastUpdatedAt) {
		return {
			score: DEFAULT_CONTENT_FRESHNESS_SCORE,
			weight: CONTENT_FRESHNESS_WEIGHT,
			weightedContribution: Number(
				(DEFAULT_CONTENT_FRESHNESS_SCORE * CONTENT_FRESHNESS_WEIGHT).toFixed(2),
			),
			factors: {
				lastUpdatedAt: null,
				daysSinceUpdate: null,
				freshnessBand: "UNKNOWN",
				defaultApplied: true,
			},
		};
	}

	const rawDays = Math.floor((asOf.getTime() - lastUpdatedAt.getTime()) / DAY_IN_MS);
	const daysSinceUpdate = Math.max(0, rawDays);

	let score = 20;
	if (daysSinceUpdate <= 30) {
		score = 100;
	} else if (daysSinceUpdate <= 60) {
		score = 85;
	} else if (daysSinceUpdate <= 90) {
		score = 70;
	} else if (daysSinceUpdate <= 120) {
		score = 55;
	} else if (daysSinceUpdate <= 180) {
		score = 35;
	}

	return {
		score,
		weight: CONTENT_FRESHNESS_WEIGHT,
		weightedContribution: Number((score * CONTENT_FRESHNESS_WEIGHT).toFixed(2)),
		factors: {
			lastUpdatedAt: lastUpdatedAt.toISOString(),
			daysSinceUpdate,
			freshnessBand: getFreshnessBand(daysSinceUpdate),
			defaultApplied: false,
		},
	};
}

function calculateActiveIssueScore(input: ActiveIssuesHealthInput): HealthScoreComponent {
	const blockedTasks = normalizeCount(input.blockedTasks);
	const urgentTasks = normalizeCount(input.urgentTasks);
	const pendingApprovals = normalizeCount(input.pendingApprovals);
	const unreadClientMessages = normalizeCount(input.unreadClientMessages);

	const totalActiveIssues =
		blockedTasks + urgentTasks + pendingApprovals + unreadClientMessages;
	const issueLoadPoints =
		blockedTasks * 3 +
		urgentTasks * 2 +
		pendingApprovals * 2 +
		unreadClientMessages;
	const score = clampScore(100 - issueLoadPoints * 6);

	return {
		score,
		weight: ACTIVE_ISSUES_WEIGHT,
		weightedContribution: Number((score * ACTIVE_ISSUES_WEIGHT).toFixed(2)),
		factors: {
			blockedTasks,
			urgentTasks,
			pendingApprovals,
			unreadClientMessages,
			totalActiveIssues,
			issueLoadPoints,
		},
	};
}

function buildReasons(result: HealthScoreResult): string[] {
	const reasons: string[] = [];

	if (result.breakdown.technical.score < 60) {
		reasons.push("Technical health below target.");
	}

	if (result.breakdown.contentFreshness.score < 60) {
		reasons.push("Content freshness needs improvement.");
	}

	if (result.breakdown.activeIssues.score < 60) {
		reasons.push("Active issue load is high.");
	}

	if (reasons.length === 0) {
		reasons.push("All core health factors are within expected range.");
	}

	return reasons;
}

export function computeHealthScore(
	input: HealthScoreInput,
	options: HealthScoreOptions = {},
): HealthScoreResult {
	const asOf = options.asOf ?? new Date();

	const technical = calculateTechnicalScore(input.technical ?? {}, asOf);
	const contentFreshness = calculateContentFreshnessScore(
		input.contentFreshness ?? {},
		asOf,
	);
	const activeIssues = calculateActiveIssueScore(input.activeIssues ?? {});

	const overallScore = clampScore(
		technical.weightedContribution +
			contentFreshness.weightedContribution +
			activeIssues.weightedContribution,
	);

	const result: HealthScoreResult = {
		overallScore,
		status: classifyStatus(overallScore),
		breakdown: {
			technical,
			contentFreshness,
			activeIssues,
		},
		reasons: [],
	};

	result.reasons = buildReasons(result);

	return result;
}

export const healthScoreConstants = {
	DEFAULT_TOTAL_EXPECTED_SOURCES,
	DEFAULT_CONTENT_FRESHNESS_SCORE,
	TECHNICAL_STALE_DAYS,
	TECHNICAL_WEIGHT,
	CONTENT_FRESHNESS_WEIGHT,
	ACTIVE_ISSUES_WEIGHT,
} as const;
