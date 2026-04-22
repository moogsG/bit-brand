import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibilityPrompts, aiVisibilityPromptSets, keywordResearch } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";
import { mapPromptsToKeywordCoverage } from "@/lib/prompt-research/gap-mapping";

const PROMPT_RESEARCH_GAPS_API_VERSION = "1.0.0" as const;

type GapsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface GapsError {
	code: GapsErrorCode;
	message: string;
	details?: unknown;
}

interface GapsEnvelope<TData> {
	version: typeof PROMPT_RESEARCH_GAPS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: GapsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<GapsEnvelope<TData>>(
		{ version: PROMPT_RESEARCH_GAPS_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: GapsError) {
	return NextResponse.json<GapsEnvelope<never>>(
		{ version: PROMPT_RESEARCH_GAPS_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

const querySchema = z.object({
	clientId: z.string().min(1),
	promptSetId: z.string().min(1),
});

export async function GET(request: NextRequest) {
	if (!phase2Flags.promptResearchV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Prompt research gap APIs are disabled in this environment (FF_PROMPT_RESEARCH_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = querySchema.safeParse({
		clientId: searchParams.get("clientId"),
		promptSetId: searchParams.get("promptSetId"),
	});
	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query params",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, promptSetId } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("promptResearch", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const promptSet = await db
			.select({ id: aiVisibilityPromptSets.id, clientId: aiVisibilityPromptSets.clientId })
			.from(aiVisibilityPromptSets)
			.where(and(eq(aiVisibilityPromptSets.id, promptSetId)))
			.get();

		if (!promptSet || promptSet.clientId !== clientId) {
			return fail(404, { code: "NOT_FOUND", message: "Prompt set not found" });
		}

		const prompts = await db
			.select({ id: aiVisibilityPrompts.id, text: aiVisibilityPrompts.text, isActive: aiVisibilityPrompts.isActive })
			.from(aiVisibilityPrompts)
			.where(eq(aiVisibilityPrompts.promptSetId, promptSetId))
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

		const mapping = mapPromptsToKeywordCoverage({
			prompts: prompts.map((p) => ({
				id: p.id,
				text: p.text,
				isActive: Boolean(p.isActive),
			})),
			keywords,
		});

		return ok({
			clientId,
			promptSetId,
			...mapping,
		});
	} catch {
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to compute gaps" });
	}
}
