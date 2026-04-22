import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiVisibility, aiVisibilityRunResults, aiVisibilityRuns } from "@/lib/db/schema";
import { computeAiVisibilityScore, visibilityEngineSchema } from "@/lib/ai/visibility-score";

function toDateStr(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export async function recomputeAiVisibilityAggregateForRun(runId: string): Promise<{
	clientId: string;
	date: string;
	overallScore: number;
	totalPromptsTested: number;
	promptsVisible: number;
}> {
	const run = await db
		.select({
			id: aiVisibilityRuns.id,
			clientId: aiVisibilityRuns.clientId,
			completedAt: aiVisibilityRuns.completedAt,
			createdAt: aiVisibilityRuns.createdAt,
		})
		.from(aiVisibilityRuns)
		.where(eq(aiVisibilityRuns.id, runId))
		.get();

	if (!run) throw new Error("Run not found");

	const date = toDateStr(new Date(run.completedAt ?? run.createdAt));

	const results = await db
		.select({
			engine: aiVisibilityRunResults.engine,
			isVisible: aiVisibilityRunResults.isVisible,
			position: aiVisibilityRunResults.position,
		})
		.from(aiVisibilityRunResults)
		.where(and(eq(aiVisibilityRunResults.runId, runId)))
		.all();

	const visibilityInputs = results
		.map((r) => {
			const engine = visibilityEngineSchema.safeParse(r.engine);
			if (!engine.success) return null;
			return {
				engine: engine.data,
				isVisible: Boolean(r.isVisible),
				position: r.position ?? null,
			};
		})
		.filter((row): row is { engine: "CHATGPT" | "PERPLEXITY" | "GEMINI"; isVisible: boolean; position: number | null } => row !== null);

	const score = computeAiVisibilityScore(visibilityInputs);

	await db
		.insert(aiVisibility)
		.values({
			clientId: run.clientId,
			date,
			overallScore: score.overallScore,
			totalPromptsTested: score.totalResults,
			promptsVisible: score.visibleResults,
			engineBreakdown: JSON.stringify({
				byEngine: score.byEngine,
				reasons: score.reasons,
			}),
			lastRunId: runId,
		})
		.onConflictDoUpdate({
			target: [aiVisibility.clientId, aiVisibility.date],
			set: {
				overallScore: score.overallScore,
				totalPromptsTested: score.totalResults,
				promptsVisible: score.visibleResults,
				engineBreakdown: JSON.stringify({
					byEngine: score.byEngine,
					reasons: score.reasons,
				}),
				lastRunId: runId,
			},
		})
		.run();

	return {
		clientId: run.clientId,
		date,
		overallScore: score.overallScore,
		totalPromptsTested: score.totalResults,
		promptsVisible: score.visibleResults,
	};
}

export async function getAiVisibilityAggregateSeries(args: {
	clientId: string;
	windowDays: number;
}): Promise<
	Array<{
		date: string;
		overallScore: number | null;
		totalPromptsTested: number;
		promptsVisible: number;
		engineBreakdown: unknown;
		lastRunId: string | null;
	}>
> {
	const rows = await db
		.select()
		.from(aiVisibility)
		.where(eq(aiVisibility.clientId, args.clientId))
		.orderBy(desc(aiVisibility.date))
		.limit(args.windowDays)
		.all();

	return [...rows]
		.map((row) => ({
			date: row.date,
			overallScore: row.overallScore ?? null,
			totalPromptsTested: row.totalPromptsTested ?? 0,
			promptsVisible: row.promptsVisible ?? 0,
			engineBreakdown: (() => {
				try {
					return JSON.parse(row.engineBreakdown ?? "{}");
				} catch {
					return {};
				}
			})(),
			lastRunId: row.lastRunId ?? null,
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
}
