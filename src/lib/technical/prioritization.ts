import type {
	TechnicalIssueSeverity,
	TechnicalIssueType,
} from "@/lib/db/schema";

export type TechnicalIssuePriorityBand = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TechnicalIssuePriorityResult {
	priorityScore: number;
	priorityBand: TechnicalIssuePriorityBand;
	proposable: boolean;
	proposableRationale: string;
}

const severityScores: Record<TechnicalIssueSeverity, number> = {
	CRITICAL: 70,
	WARNING: 45,
	INFO: 20,
};

const issueTypeWeights: Record<TechnicalIssueType, number> = {
	MISSING_TITLE: 14,
	TITLE_TOO_LONG: 8,
	MISSING_META_DESCRIPTION: 10,
	META_DESCRIPTION_TOO_LONG: 4,
	MISSING_CANONICAL: 12,
	CANONICAL_MISMATCH: 3,
	MISSING_SCHEMA: 8,
	BROKEN_LINK: 13,
	FETCH_ERROR: 15,
};

const nonProposableTypes = new Set<TechnicalIssueType>([
	"CANONICAL_MISMATCH",
	"META_DESCRIPTION_TOO_LONG",
]);

function clampScore(score: number): number {
	if (score < 0) {
		return 0;
	}
	if (score > 100) {
		return 100;
	}
	return Math.round(score);
}

function parseDetails(details: unknown): Record<string, unknown> {
	if (!details) {
		return {};
	}

	if (typeof details === "string") {
		try {
			const parsed = JSON.parse(details) as unknown;
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>;
			}
			return {};
		} catch {
			return {};
		}
	}

	if (typeof details === "object" && !Array.isArray(details)) {
		return details as Record<string, unknown>;
	}

	return {};
}

function getPriorityBand(score: number): TechnicalIssuePriorityBand {
	if (score >= 85) {
		return "URGENT";
	}
	if (score >= 65) {
		return "HIGH";
	}
	if (score >= 40) {
		return "MEDIUM";
	}
	return "LOW";
}

export function scoreTechnicalIssue(input: {
	issueType: TechnicalIssueType;
	severity: TechnicalIssueSeverity;
	details?: unknown;
}): TechnicalIssuePriorityResult {
	const details = parseDetails(input.details);
	const rationaleParts: string[] = [];

	let score =
		severityScores[input.severity] + issueTypeWeights[input.issueType];
	rationaleParts.push(`${input.severity} severity baseline applied`);
	rationaleParts.push(`Issue type ${input.issueType} weighting applied`);

	if (input.issueType === "BROKEN_LINK") {
		const status = Number(details.status);
		if (!Number.isNaN(status) && status >= 500) {
			score += 8;
			rationaleParts.push("5xx broken link increases urgency");
		} else if (!Number.isNaN(status) && status >= 400) {
			score += 5;
			rationaleParts.push("4xx broken link increases urgency");
		}
	}

	if (input.issueType === "FETCH_ERROR") {
		score += 6;
		rationaleParts.push("Fetch failures block crawl confidence");
	}

	const priorityScore = clampScore(score);
	const priorityBand = getPriorityBand(priorityScore);

	let proposable =
		priorityScore >= 40 && !nonProposableTypes.has(input.issueType);
	if (input.severity === "INFO" && priorityScore < 65) {
		proposable = false;
		rationaleParts.push(
			"Info-level issue below high threshold is auto-skipped",
		);
	}

	if (!proposable && nonProposableTypes.has(input.issueType)) {
		rationaleParts.push("Issue type is advisory and not proposal-backed");
	}

	return {
		priorityScore,
		priorityBand,
		proposable,
		proposableRationale: rationaleParts.join("; "),
	};
}
