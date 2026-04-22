import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients, keywordResearch } from "@/lib/db/schema";
import { phase1Flags } from "@/lib/flags";
import { scoreKeywordOpportunities } from "@/lib/keywords/opportunities";

const KEYWORD_OPPORTUNITIES_API_VERSION = "1.0.0" as const;

type KeywordOpportunitiesErrorCode =
	| "FEATURE_DISABLED"
	| "UNAUTHORIZED"
	| "VALIDATION_ERROR"
	| "CLIENT_NOT_FOUND"
	| "FORBIDDEN"
	| "INTERNAL_ERROR";

interface KeywordOpportunitiesError {
	code: KeywordOpportunitiesErrorCode;
	message: string;
	details?: unknown;
}

interface KeywordOpportunitiesEnvelope<TData> {
	version: typeof KEYWORD_OPPORTUNITIES_API_VERSION;
	success: boolean;
	data: TData | null;
	error: KeywordOpportunitiesError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<KeywordOpportunitiesEnvelope<TData>>(
		{
			version: KEYWORD_OPPORTUNITIES_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: KeywordOpportunitiesError) {
	return NextResponse.json<KeywordOpportunitiesEnvelope<never>>(
		{
			version: KEYWORD_OPPORTUNITIES_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const querySchema = z.object({
	clientId: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export async function GET(request: NextRequest) {
	if (!phase1Flags.technicalBaselineV1()) {
		return fail(404, {
			code: "FEATURE_DISABLED",
			message:
				"Keyword opportunities endpoint is disabled in this environment (FF_TECHNICAL_BASELINE_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, {
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	}

	const parsedQuery = querySchema.safeParse({
		clientId: request.nextUrl.searchParams.get("clientId"),
		limit: request.nextUrl.searchParams.get("limit") ?? undefined,
	});

	if (!parsedQuery.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsedQuery.error.flatten(),
		});
	}

	const { clientId, limit } = parsedQuery.data;

	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.isActive, true)))
		.get();

	if (!client) {
		return fail(404, {
			code: "CLIENT_NOT_FOUND",
			message: "Client not found",
		});
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("keywords", "view", { session, clientId, ...accessContext })) {
		return fail(403, {
			code: "FORBIDDEN",
			message: "Forbidden",
		});
	}

	try {
		const keywords = await db
			.select()
			.from(keywordResearch)
			.where(eq(keywordResearch.clientId, clientId))
			.all();

		const scored = scoreKeywordOpportunities(keywords, limit);

		return ok({
			clientId,
			...scored,
		});
	} catch (error) {
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to compute keyword opportunities",
			details: error instanceof Error ? error.message : String(error),
		});
	}
}
