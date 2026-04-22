export const EEAT_SCORE_VERSION = "eeat-score-v1" as const;

export type EeatRecommendationImpact = "LOW" | "MEDIUM" | "HIGH";
export type EeatRecommendationEffort = "LOW" | "MEDIUM" | "HIGH";

export interface EeatRecommendation {
	title: string;
	rationale: string;
	impact: EeatRecommendationImpact;
	effort: EeatRecommendationEffort;
	moduleHint?: string;
	linkedResourceHint?: string;
}

export interface EeatScoreFactor {
	key:
		| "coverage"
		| "requiredCompleteness"
		| "responseQuality"
		| "weightedAlignment";
	label: string;
	score: number;
	weight: number;
}

export interface EeatScoreComputation {
	overallScore: number;
	factorBreakdown: EeatScoreFactor[];
	recommendations: EeatRecommendation[];
	scoreVersion: typeof EEAT_SCORE_VERSION;
}

function parseImpactLike(value: unknown): EeatRecommendationImpact {
	if (typeof value !== "string") return "MEDIUM";
	const normalized = value.trim().toUpperCase();
	if (
		normalized === "LOW" ||
		normalized === "MEDIUM" ||
		normalized === "HIGH"
	) {
		return normalized;
	}
	return "MEDIUM";
}

function parseOptionalText(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseRecommendationObject(
	item: Record<string, unknown>,
): EeatRecommendation | null {
	const title =
		parseOptionalText(item.title) ??
		parseOptionalText(item.action) ??
		parseOptionalText(item.recommendation);

	if (!title) {
		return null;
	}

	const rationale =
		parseOptionalText(item.rationale) ??
		parseOptionalText(item.description) ??
		"Actionable EEAT improvement recommendation.";

	return {
		title,
		rationale,
		impact: parseImpactLike(item.impact),
		effort: parseImpactLike(item.effort),
		moduleHint:
			parseOptionalText(item.moduleHint) ?? parseOptionalText(item.module),
		linkedResourceHint:
			parseOptionalText(item.linkedResourceHint) ??
			parseOptionalText(item.linkHint) ??
			parseOptionalText(item.link),
	};
}

function parseLegacyRecommendation(item: string): EeatRecommendation {
	return {
		title: item,
		rationale:
			"Legacy recommendation preserved from prior EEAT scoring format.",
		impact: "MEDIUM",
		effort: "MEDIUM",
	};
}

export function normalizeEeatRecommendationItems(
	items: unknown,
): EeatRecommendation[] {
	if (!Array.isArray(items)) {
		return [];
	}

	return items.flatMap((item) => {
		if (typeof item === "string") {
			const trimmed = item.trim();
			return trimmed.length > 0 ? [parseLegacyRecommendation(trimmed)] : [];
		}

		if (typeof item === "object" && item !== null && !Array.isArray(item)) {
			const parsed = parseRecommendationObject(item);
			return parsed ? [parsed] : [];
		}

		return [];
	});
}

export function parseEeatRecommendationsJson(
	raw: string | null,
): EeatRecommendation[] {
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw) as unknown;
		return normalizeEeatRecommendationItems(parsed);
	} catch {
		return [];
	}
}

interface QuestionDescriptor {
	id: string;
	required: boolean;
	weight: number;
}

const FACTOR_WEIGHTS = {
	coverage: 0.2,
	requiredCompleteness: 0.3,
	responseQuality: 0.15,
	weightedAlignment: 0.35,
} as const;

function clampScore(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	if (value < 0) {
		return 0;
	}

	if (value > 100) {
		return 100;
	}

	return Number(value.toFixed(2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickQuestionId(question: Record<string, unknown>): string | null {
	const candidates = [question.id, question.key, question.slug, question.name];
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim().length > 0) {
			return candidate.trim();
		}
	}
	return null;
}

function pickQuestionWeight(question: Record<string, unknown>): number {
	const candidates = [
		question.weight,
		question.importance,
		question.scoreWeight,
	] as const;

	for (const candidate of candidates) {
		if (
			typeof candidate === "number" &&
			Number.isFinite(candidate) &&
			candidate > 0
		) {
			return candidate;
		}
	}

	return 1;
}

function pickQuestionRequired(question: Record<string, unknown>): boolean {
	if (typeof question.required === "boolean") {
		return question.required;
	}

	if (
		isRecord(question.validation) &&
		typeof question.validation.required === "boolean"
	) {
		return question.validation.required;
	}

	return false;
}

function extractQuestionDescriptors(
	questionnaireSchema: unknown,
): QuestionDescriptor[] {
	if (!isRecord(questionnaireSchema)) {
		return [];
	}

	const descriptors = new Map<string, QuestionDescriptor>();

	const addQuestion = (question: unknown) => {
		if (!isRecord(question)) {
			return;
		}

		const id = pickQuestionId(question);
		if (!id) {
			return;
		}

		descriptors.set(id, {
			id,
			required: pickQuestionRequired(question),
			weight: pickQuestionWeight(question),
		});
	};

	const visit = (node: unknown, depth = 0) => {
		if (depth > 8 || node === null || node === undefined) {
			return;
		}

		if (Array.isArray(node)) {
			for (const child of node) {
				visit(child, depth + 1);
			}
			return;
		}

		if (!isRecord(node)) {
			return;
		}

		if (Array.isArray(node.questions)) {
			for (const question of node.questions) {
				addQuestion(question);
			}
		}

		for (const value of Object.values(node)) {
			visit(value, depth + 1);
		}
	};

	visit(questionnaireSchema);

	return [...descriptors.values()];
}

function isAnswered(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	if (typeof value === "number") {
		return Number.isFinite(value);
	}

	if (typeof value === "boolean") {
		return true;
	}

	if (Array.isArray(value)) {
		return value.length > 0;
	}

	if (isRecord(value)) {
		return Object.keys(value).length > 0;
	}

	return false;
}

function scoreFromNumber(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	if (value >= 0 && value <= 1) {
		return clampScore(value * 100);
	}

	if (value >= 1 && value <= 5) {
		return clampScore(((value - 1) / 4) * 100);
	}

	if (value >= 1 && value <= 10) {
		return clampScore(((value - 1) / 9) * 100);
	}

	if (value >= 0 && value <= 100) {
		return clampScore(value);
	}

	return value > 0 ? 100 : 0;
}

function scoreFromString(value: string): number {
	const length = value.trim().length;
	if (length === 0) {
		return 0;
	}

	if (length <= 20) {
		return 40;
	}

	if (length <= 80) {
		return 70;
	}

	return 100;
}

function scoreResponseValue(value: unknown): number {
	if (!isAnswered(value)) {
		return 0;
	}

	if (typeof value === "string") {
		return scoreFromString(value);
	}

	if (typeof value === "number") {
		return scoreFromNumber(value);
	}

	if (typeof value === "boolean") {
		return value ? 100 : 50;
	}

	if (Array.isArray(value)) {
		const itemScores = value.map((item) => scoreResponseValue(item));
		if (itemScores.length === 0) {
			return 0;
		}
		const average =
			itemScores.reduce((sum, item) => sum + item, 0) / itemScores.length;
		return clampScore(Math.max(20, average));
	}

	if (isRecord(value)) {
		const knownNumeric = [value.score, value.rating, value.value].find(
			(candidate): candidate is number =>
				typeof candidate === "number" && Number.isFinite(candidate),
		);

		if (typeof knownNumeric === "number") {
			return scoreFromNumber(knownNumeric);
		}

		const nestedScores = Object.values(value).map((nested) =>
			scoreResponseValue(nested),
		);
		if (nestedScores.length === 0) {
			return 0;
		}
		return clampScore(
			nestedScores.reduce((sum, nested) => sum + nested, 0) /
				nestedScores.length,
		);
	}

	return 0;
}

function buildRecommendations(input: {
	coverage: number;
	requiredCompleteness: number;
	responseQuality: number;
	missingRequiredQuestionIds: string[];
	overallScore: number;
}): EeatRecommendation[] {
	const recommendations: EeatRecommendation[] = [];

	if (input.requiredCompleteness < 80) {
		const missing = input.missingRequiredQuestionIds.slice(0, 5);
		recommendations.push(
			missing.length > 0
				? {
						title: `Answer required questions first: ${missing.join(", ")}${input.missingRequiredQuestionIds.length > 5 ? ", ..." : ""}.`,
						rationale:
							"Required responses carry outsized weight in EEAT confidence and unlock stronger scoring accuracy.",
						impact: "HIGH",
						effort: "MEDIUM",
						moduleHint: "onboarding",
						linkedResourceHint: "Questionnaire required fields",
					}
				: {
						title: "Answer all required questions",
						rationale:
							"Completing required answers improves trust and confidence coverage before optional refinements.",
						impact: "HIGH",
						effort: "MEDIUM",
						moduleHint: "onboarding",
					},
		);
	}

	if (input.coverage < 70) {
		recommendations.push({
			title: "Increase optional answer coverage",
			rationale:
				"Broader coverage gives the model enough context to assess consistency across EEAT dimensions.",
			impact: "MEDIUM",
			effort: "LOW",
			moduleHint: "onboarding",
			linkedResourceHint: "Optional questionnaire sections",
		});
	}

	if (input.responseQuality < 65) {
		recommendations.push({
			title: "Add evidence-backed details",
			rationale:
				"Specific metrics, examples, and proof points increase perceived expertise and trustworthiness.",
			impact: "HIGH",
			effort: "MEDIUM",
			moduleHint: "content",
			linkedResourceHint: "Case studies and source references",
		});
	}

	if (recommendations.length === 0 && input.overallScore >= 80) {
		recommendations.push({
			title: "Maintain EEAT baseline with periodic refreshes",
			rationale:
				"Scores are strong; lightweight maintenance avoids staleness and preserves trust signals.",
			impact: "MEDIUM",
			effort: "LOW",
			moduleHint: "content",
			linkedResourceHint: "Quarterly EEAT review checklist",
		});
	}

	if (recommendations.length === 0) {
		recommendations.push({
			title: "Review low-confidence answers",
			rationale:
				"Targeting uncertain responses first is a low-risk way to raise confidence and coverage.",
			impact: "MEDIUM",
			effort: "LOW",
			moduleHint: "onboarding",
		});
	}

	return recommendations;
}

export function computeEeatScore(input: {
	questionnaireSchema: unknown;
	responsePayload: unknown;
}): EeatScoreComputation {
	const responsePayload = isRecord(input.responsePayload)
		? input.responsePayload
		: {};
	const questionDescriptors = extractQuestionDescriptors(
		input.questionnaireSchema,
	);

	const effectiveQuestions: QuestionDescriptor[] =
		questionDescriptors.length > 0
			? questionDescriptors
			: Object.keys(responsePayload).map((key) => ({
					id: key,
					required: false,
					weight: 1,
				}));

	if (effectiveQuestions.length === 0) {
		return {
			overallScore: 0,
			factorBreakdown: [
				{
					key: "coverage",
					label: "Coverage",
					score: 0,
					weight: FACTOR_WEIGHTS.coverage,
				},
				{
					key: "requiredCompleteness",
					label: "Required Completeness",
					score: 0,
					weight: FACTOR_WEIGHTS.requiredCompleteness,
				},
				{
					key: "responseQuality",
					label: "Response Quality",
					score: 0,
					weight: FACTOR_WEIGHTS.responseQuality,
				},
				{
					key: "weightedAlignment",
					label: "Weighted Alignment",
					score: 0,
					weight: FACTOR_WEIGHTS.weightedAlignment,
				},
			],
			recommendations: [
				{
					title: "Submit an EEAT questionnaire response",
					rationale:
						"Scoring requires at least one questionnaire and response payload.",
					impact: "HIGH",
					effort: "LOW",
					moduleHint: "onboarding",
				},
			],
			scoreVersion: EEAT_SCORE_VERSION,
		};
	}

	let answeredCount = 0;
	let requiredTotalWeight = 0;
	let requiredAnsweredWeight = 0;
	let totalWeight = 0;
	let weightedQualityScore = 0;
	let answeredQualityScore = 0;
	const missingRequiredQuestionIds: string[] = [];

	for (const question of effectiveQuestions) {
		const responseValue = responsePayload[question.id];
		const answered = isAnswered(responseValue);
		const quality = scoreResponseValue(responseValue);

		if (answered) {
			answeredCount += 1;
			answeredQualityScore += quality;
		}

		if (question.required) {
			requiredTotalWeight += question.weight;
			if (answered) {
				requiredAnsweredWeight += question.weight;
			} else {
				missingRequiredQuestionIds.push(question.id);
			}
		}

		totalWeight += question.weight;
		weightedQualityScore += quality * question.weight;
	}

	const coverage = clampScore(
		(answeredCount / effectiveQuestions.length) * 100,
	);
	const requiredCompleteness = clampScore(
		requiredTotalWeight > 0
			? (requiredAnsweredWeight / requiredTotalWeight) * 100
			: coverage,
	);
	const responseQuality = clampScore(
		answeredCount > 0 ? answeredQualityScore / answeredCount : 0,
	);
	const weightedAlignment = clampScore(
		totalWeight > 0 ? weightedQualityScore / totalWeight : 0,
	);

	const overallScore = clampScore(
		coverage * FACTOR_WEIGHTS.coverage +
			requiredCompleteness * FACTOR_WEIGHTS.requiredCompleteness +
			responseQuality * FACTOR_WEIGHTS.responseQuality +
			weightedAlignment * FACTOR_WEIGHTS.weightedAlignment,
	);

	const factorBreakdown: EeatScoreFactor[] = [
		{
			key: "coverage",
			label: "Coverage",
			score: coverage,
			weight: FACTOR_WEIGHTS.coverage,
		},
		{
			key: "requiredCompleteness",
			label: "Required Completeness",
			score: requiredCompleteness,
			weight: FACTOR_WEIGHTS.requiredCompleteness,
		},
		{
			key: "responseQuality",
			label: "Response Quality",
			score: responseQuality,
			weight: FACTOR_WEIGHTS.responseQuality,
		},
		{
			key: "weightedAlignment",
			label: "Weighted Alignment",
			score: weightedAlignment,
			weight: FACTOR_WEIGHTS.weightedAlignment,
		},
	];

	const recommendations = buildRecommendations({
		coverage,
		requiredCompleteness,
		responseQuality,
		missingRequiredQuestionIds,
		overallScore,
	});

	return {
		overallScore,
		factorBreakdown,
		recommendations,
		scoreVersion: EEAT_SCORE_VERSION,
	};
}
