import { and, desc, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiPromptCitations, aiVisibilityPromptSets } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";

const PROMPT_RESEARCH_READMODEL_API_VERSION = "1.0.0" as const;

type ReadModelErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface ReadModelError {
	code: ReadModelErrorCode;
	message: string;
	details?: unknown;
}

interface ReadModelEnvelope<TData> {
	version: typeof PROMPT_RESEARCH_READMODEL_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ReadModelError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ReadModelEnvelope<TData>>(
		{
			version: PROMPT_RESEARCH_READMODEL_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: ReadModelError) {
	return NextResponse.json<ReadModelEnvelope<never>>(
		{
			version: PROMPT_RESEARCH_READMODEL_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const querySchema = z.object({
	window: z
		.enum(["30", "90"])
		.optional()
		.transform((v) => (v ? Number.parseInt(v, 10) : 30)),
	promptSetId: z.string().min(1).optional(),
});

function dateMinusDays(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

function normalizeDomain(domain: string): string {
	return domain.trim().toLowerCase().replace(/^www\./, "");
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ clientId: string }> },
) {
	if (!phase2Flags.promptResearchV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Prompt research APIs are disabled in this environment (FF_PROMPT_RESEARCH_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const { clientId } = await params;
	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsedQuery = querySchema.safeParse({
		window: searchParams.get("window") ?? undefined,
		promptSetId: searchParams.get("promptSetId") ?? undefined,
	});
	if (!parsedQuery.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query params",
			details: parsedQuery.error.flatten(),
		});
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("promptResearch", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const { window, promptSetId: promptSetIdFromQuery } = parsedQuery.data;
	const startDate = dateMinusDays(window);

	try {
		// Choose prompt set:
		// - if promptSetId provided: use it
		// - else: most recently updated active prompt set
		const promptSet = await db
			.select({
				id: aiVisibilityPromptSets.id,
				clientId: aiVisibilityPromptSets.clientId,
				name: aiVisibilityPromptSets.name,
			})
			.from(aiVisibilityPromptSets)
			.where(
				and(
					eq(aiVisibilityPromptSets.clientId, clientId),
					promptSetIdFromQuery
						? eq(aiVisibilityPromptSets.id, promptSetIdFromQuery)
						: eq(aiVisibilityPromptSets.isActive, true),
				),
			)
			.orderBy(desc(aiVisibilityPromptSets.updatedAt))
			.get();

		if (!promptSet) {
			return fail(404, {
				code: "NOT_FOUND",
				message:
					"No prompt set found for client (provide promptSetId or create an active prompt set)",
			});
		}

		// Citations summary (domain -> counts).
		const citationRows = await db
			.select({
				domain: aiPromptCitations.domain,
				engine: aiPromptCitations.engine,
				contentType: aiPromptCitations.contentType,
				date: aiPromptCitations.date,
			})
			.from(aiPromptCitations)
			.where(
				and(
					eq(aiPromptCitations.clientId, clientId),
					gte(aiPromptCitations.date, startDate),
				),
			)
			.limit(5000)
			.all();

		const domainAgg: Record<
			string,
			{
				domain: string;
				total: number;
				byEngine: Record<string, number>;
				byContentType: Record<string, number>;
				latestDate: string;
			}
		> = {};
		for (const row of citationRows) {
			const d = normalizeDomain(row.domain);
			const existing = domainAgg[d] ?? {
				domain: d,
				total: 0,
				byEngine: {},
				byContentType: {},
				latestDate: row.date,
			};
			existing.total += 1;
			existing.byEngine[row.engine] = (existing.byEngine[row.engine] ?? 0) + 1;
			existing.byContentType[row.contentType] =
				(existing.byContentType[row.contentType] ?? 0) + 1;
			if (row.date > existing.latestDate) existing.latestDate = row.date;
			domainAgg[d] = existing;
		}

		const topDomains = Object.values(domainAgg)
			.sort((a, b) => b.total - a.total)
			.slice(0, 50);

		// Competitor heuristic: exclude client's own domain when available.
		// We don't have competitor tables yet in Phase 2, so this is best-effort.
		const clientDomainNorm = "";
		const topCompetitorDomains = (clientDomainNorm
			? topDomains.filter((d) => d.domain !== clientDomainNorm)
			: topDomains
		).slice(0, 15);

		// Coverage: reuse gaps endpoint logic directly via service.
		const { mapPromptsToKeywordCoverage } = await import(
			"@/lib/prompt-research/gap-mapping"
		);
		const { aiVisibilityPrompts, keywordResearch } = await import("@/lib/db/schema");
		const prompts = await db
			.select({ id: aiVisibilityPrompts.id, text: aiVisibilityPrompts.text, isActive: aiVisibilityPrompts.isActive })
			.from(aiVisibilityPrompts)
			.where(eq(aiVisibilityPrompts.promptSetId, promptSet.id))
			.all();
		const keywords = await db
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
			.all();

		const coverage = mapPromptsToKeywordCoverage({
			prompts: prompts.map((p) => ({
				id: p.id,
				text: p.text,
				isActive: Boolean(p.isActive),
			})),
			keywords,
		});

		return ok({
			windowDays: window,
			startDate,
			promptSet,
			topDomains,
			topCompetitorDomains,
			coverage,
			notes: [
				"Phase 2 prompt research is heuristic; content coverage is inferred from keyword research and prompt text matching.",
				"Competitor domains are inferred from citation domains; explicit competitor modeling lands in later phases.",
			],
		});
	} catch {
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to build prompt research model" });
	}
}
