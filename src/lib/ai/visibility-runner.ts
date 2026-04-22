import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
	aiVisibilityPrompts,
	aiVisibilityPromptSets,
	aiVisibilityRunResults,
	aiVisibilityRuns,
} from "@/lib/db/schema";
import { executeVisibilityPrompt } from "@/lib/ai/visibility-executor";

export const AI_VISIBILITY_RUNNER_VERSION = "1.0.0" as const;

export const aiVisibilityEngineSchema = z.enum([
	"CHATGPT",
	"PERPLEXITY",
	"GEMINI",
]);

export type AiVisibilityEngine = z.infer<typeof aiVisibilityEngineSchema>;

export const aiVisibilityEnginesSchema = z
	.array(aiVisibilityEngineSchema)
	.min(1)
	.max(8);

export const aiVisibilityRunStatusSchema = z.enum([
	"PENDING",
	"RUNNING",
	"SUCCESS",
	"FAILED",
]);

export type AiVisibilityRunStatus = z.infer<typeof aiVisibilityRunStatusSchema>;

export async function executeAiVisibilityRun(runId: string): Promise<{
	status: AiVisibilityRunStatus;
	insertedResults: number;
	executor: {
		requestedModes: string[];
		effectiveModes: string[];
		sources: string[];
		fallbackCount: number;
	};
}> {
	// Fetch run.
	const run = await db
		.select()
		.from(aiVisibilityRuns)
		.where(eq(aiVisibilityRuns.id, runId))
		.get();

	if (!run) {
		throw new Error(`Run not found: ${runId}`);
	}

	const currentStatus = aiVisibilityRunStatusSchema.parse(run.status);
	if (currentStatus === "SUCCESS") {
		return {
			status: "SUCCESS",
			insertedResults: 0,
			executor: {
				requestedModes: [],
				effectiveModes: [],
				sources: [],
				fallbackCount: 0,
			},
		};
	}
	if (currentStatus === "RUNNING") {
		return {
			status: "RUNNING",
			insertedResults: 0,
			executor: {
				requestedModes: [],
				effectiveModes: [],
				sources: [],
				fallbackCount: 0,
			},
		};
	}

	// Validate prompt set belongs to client.
	const promptSet = await db
		.select({ id: aiVisibilityPromptSets.id })
		.from(aiVisibilityPromptSets)
		.where(
			and(
				eq(aiVisibilityPromptSets.id, run.promptSetId),
				eq(aiVisibilityPromptSets.clientId, run.clientId),
			),
		)
		.get();

	if (!promptSet) {
		await db
			.update(aiVisibilityRuns)
			.set({
				status: "FAILED",
				error: "Prompt set not found for client",
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(aiVisibilityRuns.id, runId))
			.run();
		return {
			status: "FAILED",
			insertedResults: 0,
			executor: {
				requestedModes: [],
				effectiveModes: [],
				sources: [],
				fallbackCount: 0,
			},
		};
	}

	// Move run to RUNNING.
	await db
		.update(aiVisibilityRuns)
		.set({ status: "RUNNING", startedAt: new Date(), updatedAt: new Date() })
		.where(eq(aiVisibilityRuns.id, runId))
		.run();

	let engines: AiVisibilityEngine[];
	try {
		engines = aiVisibilityEnginesSchema.parse(JSON.parse(run.engines));
	} catch {
		engines = ["CHATGPT", "PERPLEXITY", "GEMINI"];
	}

	// Load active prompts.
	const prompts = await db
		.select({ id: aiVisibilityPrompts.id, text: aiVisibilityPrompts.text })
		.from(aiVisibilityPrompts)
		.where(
			and(
				eq(aiVisibilityPrompts.promptSetId, run.promptSetId),
				eq(aiVisibilityPrompts.isActive, true),
			),
		)
		.all();

	let inserted = 0;
	const requestedModes = new Set<string>();
	const effectiveModes = new Set<string>();
	const sources = new Set<string>();
	let fallbackCount = 0;
	try {
		for (const prompt of prompts) {
			for (const engine of engines) {
				const execution = executeVisibilityPrompt({
					engine,
					promptText: prompt.text,
				});

				requestedModes.add(execution.metadata.requestedMode);
				effectiveModes.add(execution.metadata.effectiveMode);
				sources.add(execution.metadata.source);
				if (execution.metadata.usedFallback) fallbackCount += 1;

				await db
					.insert(aiVisibilityRunResults)
					.values({
						runId: runId,
						clientId: run.clientId,
						promptId: prompt.id,
						engine,
						promptText: prompt.text,
						isVisible: execution.isVisible,
						position: execution.position,
						citationDomain: execution.citationDomain,
						citationSnippet: execution.citationSnippet,
						responseSnippet: execution.responseSnippet,
					})
					.run();
				inserted += 1;
			}
		}

		await db
			.update(aiVisibilityRuns)
			.set({ status: "SUCCESS", completedAt: new Date(), updatedAt: new Date() })
			.where(eq(aiVisibilityRuns.id, runId))
			.run();

		// Update day-level aggregate for this run (best-effort).
		try {
			const { recomputeAiVisibilityAggregateForRun } = await import(
				"@/lib/ai/visibility-aggregate"
			);
			await recomputeAiVisibilityAggregateForRun(runId);
		} catch {
			// Swallow: run success should not be blocked by aggregation failures.
		}

		// Parse and persist citations for prompt research (best-effort).
		try {
			const { persistCitationsForRun } = await import(
				"@/lib/prompt-research/persist-citations"
			);
			await persistCitationsForRun(runId);
		} catch {
			// Swallow: citations are optional and should not break runs.
		}

		return {
			status: "SUCCESS",
			insertedResults: inserted,
			executor: {
				requestedModes: Array.from(requestedModes),
				effectiveModes: Array.from(effectiveModes),
				sources: Array.from(sources),
				fallbackCount,
			},
		};
	} catch (err) {
		await db
			.update(aiVisibilityRuns)
			.set({
				status: "FAILED",
				error: err instanceof Error ? err.message : "Run failed",
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(aiVisibilityRuns.id, runId))
			.run();

		return {
			status: "FAILED",
			insertedResults: inserted,
			executor: {
				requestedModes: Array.from(requestedModes),
				effectiveModes: Array.from(effectiveModes),
				sources: Array.from(sources),
				fallbackCount,
			},
		};
	}
}

export async function getAiVisibilityRunSummary(runId: string): Promise<{
	runId: string;
	totalResults: number;
	visibleResults: number;
	byEngine: Record<string, { total: number; visible: number }>;
}> {
	const rows = await db
		.select({
			engine: aiVisibilityRunResults.engine,
			isVisible: aiVisibilityRunResults.isVisible,
		})
		.from(aiVisibilityRunResults)
		.where(eq(aiVisibilityRunResults.runId, runId))
		.all();

	const byEngine: Record<string, { total: number; visible: number }> = {};
	let visible = 0;
	for (const row of rows) {
		const key = row.engine;
		byEngine[key] = byEngine[key] ?? { total: 0, visible: 0 };
		byEngine[key].total += 1;
		if (row.isVisible) {
			visible += 1;
			byEngine[key].visible += 1;
		}
	}

	return {
		runId,
		totalResults: rows.length,
		visibleResults: visible,
		byEngine,
	};
}
