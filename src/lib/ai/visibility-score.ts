import { z } from "zod";

export const AI_VISIBILITY_SCORE_VERSION = "1.0.0" as const;

export const visibilityEngineSchema = z.enum([
	"CHATGPT",
	"PERPLEXITY",
	"GEMINI",
]);

export type VisibilityEngine = z.infer<typeof visibilityEngineSchema>;

export const visibilityResultInputSchema = z.object({
	engine: visibilityEngineSchema,
	isVisible: z.boolean(),
	position: z.number().int().positive().nullable().optional(),
});

export type VisibilityResultInput = z.infer<typeof visibilityResultInputSchema>;

export interface VisibilityScoreBreakdown {
	engine: VisibilityEngine;
	total: number;
	visible: number;
	avgPosition: number | null;
	engineScore: number; // 0-100
}

export interface VisibilityScoreOutput {
	version: typeof AI_VISIBILITY_SCORE_VERSION;
	overallScore: number; // 0-100
	totalResults: number;
	visibleResults: number;
	byEngine: VisibilityScoreBreakdown[];
	reasons: string[];
}

function clamp0to100(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, value));
}

function positionToScore(position: number | null | undefined): number {
	if (!position || position <= 0) return 0;
	// Deterministic curve: position 1 => 1.0, 2 => 0.9, 3 => 0.8, ... floor at 0.2
	const raw = 1 - (position - 1) * 0.1;
	return Math.max(0.2, Math.min(1, raw));
}

export function computeAiVisibilityScore(
	results: VisibilityResultInput[],
): VisibilityScoreOutput {
	const parsed = results.map((r) => visibilityResultInputSchema.parse(r));

	const engines: VisibilityEngine[] = ["CHATGPT", "PERPLEXITY", "GEMINI"];
	const breakdown: VisibilityScoreBreakdown[] = engines.map((engine) => {
		const rows = parsed.filter((r) => r.engine === engine);
		const total = rows.length;
		const visibleRows = rows.filter((r) => r.isVisible);
		const visible = visibleRows.length;
		const avgPosition =
			visibleRows.length === 0
				? null
				: visibleRows.reduce((acc, r) => acc + (r.position ?? 0), 0) /
					visibleRows.length;

		const perRowScores = rows.map((r) => {
			if (!r.isVisible) return 0;
			return positionToScore(r.position ?? null);
		});
		const engineScore =
			total === 0
				? 0
				: clamp0to100(
					(perRowScores.reduce((a, b) => a + b, 0) / total) * 100,
				);

		return {
			engine,
			total,
			visible,
			avgPosition,
			engineScore,
		};
	});

	const totalResults = parsed.length;
	const visibleResults = parsed.filter((r) => r.isVisible).length;
	const overallScore =
		breakdown.length === 0
			? 0
			: clamp0to100(
				breakdown.reduce((acc, b) => acc + b.engineScore, 0) / breakdown.length,
			);

	const reasons: string[] = [];
	if (totalResults === 0) reasons.push("No run results available");
	if (overallScore >= 80) reasons.push("Strong cross-engine visibility");
	if (overallScore < 40 && totalResults > 0) reasons.push("Low visibility across engines");

	return {
		version: AI_VISIBILITY_SCORE_VERSION,
		overallScore,
		totalResults,
		visibleResults,
		byEngine: breakdown,
		reasons,
	};
}
