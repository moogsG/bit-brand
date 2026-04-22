import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { phase2Flags } from "@/lib/flags";
import { buildPromptResearchRecommendations } from "@/lib/prompt-research/recommendations";

const PROMPT_RESEARCH_RECOMMENDATIONS_API_VERSION = "1.0.0" as const;

type PromptResearchRecommendationsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface PromptResearchRecommendationsError {
	code: PromptResearchRecommendationsErrorCode;
	message: string;
	details?: unknown;
}

interface PromptResearchRecommendationsEnvelope<TData> {
	version: typeof PROMPT_RESEARCH_RECOMMENDATIONS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: PromptResearchRecommendationsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<PromptResearchRecommendationsEnvelope<TData>>(
		{
			version: PROMPT_RESEARCH_RECOMMENDATIONS_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: PromptResearchRecommendationsError) {
	return NextResponse.json<PromptResearchRecommendationsEnvelope<never>>(
		{
			version: PROMPT_RESEARCH_RECOMMENDATIONS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const querySchema = z.object({
	clientId: z.string().min(1),
	promptSetId: z.string().min(1).optional(),
	window: z
		.enum(["30", "90"])
		.optional()
		.transform((v) => (v ? Number.parseInt(v, 10) : 30)),
	limit: z
		.string()
		.optional()
		.transform((v) => {
			if (!v) return 5;
			const parsed = Number.parseInt(v, 10);
			if (!Number.isFinite(parsed)) return 5;
			return Math.max(1, Math.min(10, parsed));
		}),
});

export async function GET(request: NextRequest) {
	if (!phase2Flags.promptResearchV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Prompt research recommendation APIs are disabled in this environment (FF_PROMPT_RESEARCH_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const searchParams =
		request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = querySchema.safeParse({
		clientId: searchParams.get("clientId"),
		promptSetId: searchParams.get("promptSetId") ?? undefined,
		window: searchParams.get("window") ?? undefined,
		limit: searchParams.get("limit") ?? undefined,
	});

	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query params",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, promptSetId, window, limit } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("promptResearch", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const data = await buildPromptResearchRecommendations({
			clientId,
			promptSetId,
			windowDays: window as 30 | 90,
			limit,
		});
		return ok(data);
	} catch {
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to compute prompt research recommendations",
		});
	}
}
