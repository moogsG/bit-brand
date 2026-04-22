import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import type { EeatRecommendation } from "@/lib/eeat/scoring";
import {
	getEeatScoreTrendForClient,
	getLatestEeatScoreForClient,
	parseFactorBreakdown,
	parseRecommendations,
} from "@/lib/eeat/service";
import { phase2Flags } from "@/lib/flags";

const EEAT_SCORE_READ_API_VERSION = "1.0.0" as const;

type EeatScoreReadErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface EeatScoreReadError {
	code: EeatScoreReadErrorCode;
	message: string;
	details?: unknown;
}

interface EeatScoreReadEnvelope<TData> {
	version: typeof EEAT_SCORE_READ_API_VERSION;
	success: boolean;
	data: TData | null;
	error: EeatScoreReadError | null;
}

interface EeatScoreReadData {
	clientId: string;
	latest: {
		id: string;
		responseId: string;
		questionnaireId: string;
		briefId: string | null;
		overallScore: number;
		scoreVersion: string;
		createdAt: Date;
		factorBreakdown: ReturnType<typeof parseFactorBreakdown>;
		recommendations: EeatRecommendation[];
	} | null;
	trend: Array<{
		id: string;
		responseId: string;
		questionnaireId: string;
		overallScore: number;
		scoreVersion: string;
		createdAt: Date;
	}>;
}

const paramsSchema = z.object({
	clientId: z.string().min(1),
});

const querySchema = z.object({
	limit: z.coerce.number().int().min(1).max(52).default(12),
});

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<EeatScoreReadEnvelope<TData>>(
		{
			version: EEAT_SCORE_READ_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: EeatScoreReadError) {
	return NextResponse.json<EeatScoreReadEnvelope<never>>(
		{
			version: EEAT_SCORE_READ_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ clientId: string }> },
) {
	if (!phase2Flags.eeatScoringV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"EEAT scoring APIs are disabled in this environment (FF_EEAT_SCORING_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const parsedParams = paramsSchema.safeParse(await params);
	if (!parsedParams.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid route params",
			details: parsedParams.error.flatten(),
		});
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = querySchema.safeParse({
		limit: searchParams.get("limit") ?? undefined,
	});
	if (!parsedQuery.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsedQuery.error.flatten(),
		});
	}

	const { clientId } = parsedParams.data;
	const { limit } = parsedQuery.data;

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("content", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const [latest, trend] = await Promise.all([
			getLatestEeatScoreForClient(clientId),
			getEeatScoreTrendForClient(clientId, limit),
		]);

		const payload: EeatScoreReadData = {
			clientId,
			latest: latest
				? {
						id: latest.id,
						responseId: latest.responseId,
						questionnaireId: latest.questionnaireId,
						briefId: latest.briefId,
						overallScore: latest.overallScore,
						scoreVersion: latest.scoreVersion,
						createdAt: latest.createdAt,
						factorBreakdown: parseFactorBreakdown(latest.factorBreakdown),
						recommendations: parseRecommendations(latest.recommendations),
					}
				: null,
			trend,
		};

		return ok(payload);
	} catch (error) {
		console.error("[eeat.scores] read failed", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to load EEAT scores",
		});
	}
}
