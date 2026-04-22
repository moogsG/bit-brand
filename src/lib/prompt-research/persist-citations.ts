import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	aiPromptCitations,
	aiVisibilityRunResults,
	aiVisibilityRuns,
} from "@/lib/db/schema";
import { parseCitationCandidates } from "@/lib/prompt-research/citations";

function toDateStr(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export async function persistCitationsForRun(runId: string): Promise<{ inserted: number }> {
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

	if (!run) return { inserted: 0 };
	const date = toDateStr(new Date(run.completedAt ?? run.createdAt));

	const results = await db
		.select({
			id: aiVisibilityRunResults.id,
			promptId: aiVisibilityRunResults.promptId,
			engine: aiVisibilityRunResults.engine,
			citationDomain: aiVisibilityRunResults.citationDomain,
			citationSnippet: aiVisibilityRunResults.citationSnippet,
			responseSnippet: aiVisibilityRunResults.responseSnippet,
		})
		.from(aiVisibilityRunResults)
		.where(and(eq(aiVisibilityRunResults.runId, runId)))
		.all();

	let inserted = 0;
	for (const result of results) {
		const candidates = parseCitationCandidates({
			citationDomain: result.citationDomain,
			citationSnippet: result.citationSnippet,
			responseSnippet: result.responseSnippet,
		});

		for (const c of candidates) {
			await db
				.insert(aiPromptCitations)
				.values({
					clientId: run.clientId,
					date,
					runId: runId,
					runResultId: result.id,
					promptId: result.promptId,
					engine: result.engine,
					domain: c.domain,
					url: c.url,
					title: c.title,
					contentType: c.contentType,
					freshnessHint: c.freshnessHint,
				})
				.onConflictDoNothing();
			inserted += 1;
		}
	}

	return { inserted };
}
