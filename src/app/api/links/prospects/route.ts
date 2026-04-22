import { and, desc, eq, like, type SQL } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import {
	linkProspectLifecycleStates,
	linkProspects,
} from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import { computeLinkProspectScore } from "@/lib/links/scoring";

const LINKS_PROSPECTS_API_VERSION = "1.0.0" as const;

type LinksProspectsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface LinksProspectsError {
	code: LinksProspectsErrorCode;
	message: string;
	details?: unknown;
}

interface LinksProspectsEnvelope<TData> {
	version: typeof LINKS_PROSPECTS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LinksProspectsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<LinksProspectsEnvelope<TData>>(
		{
			version: LINKS_PROSPECTS_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: LinksProspectsError) {
	return NextResponse.json<LinksProspectsEnvelope<never>>(
		{
			version: LINKS_PROSPECTS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const getQuerySchema = z.object({
	clientId: z.string().min(1),
	lifecycleState: z.enum(linkProspectLifecycleStates).optional(),
	query: z.string().trim().min(1).max(120).optional(),
});

const createSchema = z.object({
	clientId: z.string().min(1),
	domain: z.string().trim().min(1).max(255),
	url: z.string().url().trim().max(2048).nullable().optional(),
	contactName: z.string().trim().max(160).nullable().optional(),
	contactEmail: z.string().trim().email().max(254).nullable().optional(),
	notes: z.string().trim().max(4000).nullable().optional(),
	lifecycleState: z.enum(linkProspectLifecycleStates).optional(),
	relevanceScore: z.number().min(0).max(100).optional(),
	authorityScore: z.number().min(0).max(100).optional(),
	trafficScore: z.number().min(0).max(100).optional(),
	relationshipScore: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
	if (!phase3Flags.linksV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Links APIs are disabled in this environment (FF_LINKS_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const searchParams =
		request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = getQuerySchema.safeParse({
		clientId: searchParams.get("clientId") ?? undefined,
		lifecycleState: searchParams.get("lifecycleState") ?? undefined,
		query: searchParams.get("query") ?? undefined,
	});

	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, lifecycleState, query } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("links", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const conditions: SQL[] = [eq(linkProspects.clientId, clientId)];
		if (lifecycleState) {
			conditions.push(eq(linkProspects.lifecycleState, lifecycleState));
		}
		if (query) {
			conditions.push(like(linkProspects.domain, `%${query}%`));
		}

		const rows = await db
			.select()
			.from(linkProspects)
			.where(and(...conditions))
			.orderBy(
				desc(linkProspects.deterministicScore),
				desc(linkProspects.updatedAt),
			)
			.all();

		return ok(rows);
	} catch (error) {
		console.error("[links.prospects] list failed", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list link prospects",
		});
	}
}

export async function POST(request: NextRequest) {
	if (!phase3Flags.linksV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Links APIs are disabled in this environment (FF_LINKS_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	let parsed: z.infer<typeof createSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createSchema.safeParse(body);
		if (!validation.success) {
			return fail(400, {
				code: "VALIDATION_ERROR",
				message: "Invalid request payload",
				details: validation.error.flatten(),
			});
		}
		parsed = validation.data;
	} catch {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Request body must be valid JSON",
		});
	}

	const accessContext = await getClientAccessContext(session, parsed.clientId);
	if (!can("links", "edit", { session, clientId: parsed.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const score = computeLinkProspectScore({
			relevanceScore: parsed.relevanceScore,
			authorityScore: parsed.authorityScore,
			trafficScore: parsed.trafficScore,
			relationshipScore: parsed.relationshipScore,
		});

		const now = new Date();
		const [created] = await db
			.insert(linkProspects)
			.values({
				clientId: parsed.clientId,
				domain: parsed.domain,
				url: parsed.url ?? null,
				contactName: parsed.contactName ?? null,
				contactEmail: parsed.contactEmail ?? null,
				notes: parsed.notes ?? null,
				lifecycleState: parsed.lifecycleState ?? "DISCOVERED",
				relevanceScore: score.breakdown.relevance,
				authorityScore: score.breakdown.authority,
				trafficScore: score.breakdown.traffic,
				relationshipScore: score.breakdown.relationship,
				deterministicScore: score.score,
				scoreBreakdown: JSON.stringify(score.breakdown),
				createdBy: session.user.id,
				updatedBy: session.user.id,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return ok(created ?? null, 201);
	} catch (error) {
		console.error("[links.prospects] create failed", {
			clientId: parsed.clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create link prospect",
		});
	}
}
