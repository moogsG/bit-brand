import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import {
	linkProspectLifecycleStates,
	linkProspects,
	linkOutreachDrafts,
} from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import { computeLinkProspectScore } from "@/lib/links/scoring";

const LINKS_PROSPECT_DETAIL_API_VERSION = "1.0.0" as const;

type LinksProspectDetailErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "CONFLICT"
	| "INTERNAL_ERROR";

interface LinksProspectDetailError {
	code: LinksProspectDetailErrorCode;
	message: string;
	details?: unknown;
}

interface LinksProspectDetailEnvelope<TData> {
	version: typeof LINKS_PROSPECT_DETAIL_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LinksProspectDetailError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<LinksProspectDetailEnvelope<TData>>(
		{
			version: LINKS_PROSPECT_DETAIL_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: LinksProspectDetailError) {
	return NextResponse.json<LinksProspectDetailEnvelope<never>>(
		{
			version: LINKS_PROSPECT_DETAIL_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const patchSchema = z.object({
	domain: z.string().trim().min(1).max(255).optional(),
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

interface RouteContext {
	params: Promise<{ id: string }>;
}

async function loadProspectForAccess(id: string) {
	return db
		.select({
			id: linkProspects.id,
			clientId: linkProspects.clientId,
			relevanceScore: linkProspects.relevanceScore,
			authorityScore: linkProspects.authorityScore,
			trafficScore: linkProspects.trafficScore,
			relationshipScore: linkProspects.relationshipScore,
		})
		.from(linkProspects)
		.where(eq(linkProspects.id, id))
		.get();
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

	const { id } = await context.params;
	const prospect = await loadProspectForAccess(id);
	if (!prospect) {
		return fail(404, { code: "NOT_FOUND", message: "Link prospect not found" });
	}

	const accessContext = await getClientAccessContext(session, prospect.clientId);
	if (!can("links", "edit", { session, clientId: prospect.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	let parsed: z.infer<typeof patchSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = patchSchema.safeParse(body);
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

	try {
		const nextScores = computeLinkProspectScore({
			relevanceScore: parsed.relevanceScore ?? prospect.relevanceScore,
			authorityScore: parsed.authorityScore ?? prospect.authorityScore,
			trafficScore: parsed.trafficScore ?? prospect.trafficScore,
			relationshipScore: parsed.relationshipScore ?? prospect.relationshipScore,
		});

		const [updated] = await db
			.update(linkProspects)
			.set({
				domain: parsed.domain,
				url: parsed.url,
				contactName: parsed.contactName,
				contactEmail: parsed.contactEmail,
				notes: parsed.notes,
				lifecycleState: parsed.lifecycleState,
				relevanceScore: nextScores.breakdown.relevance,
				authorityScore: nextScores.breakdown.authority,
				trafficScore: nextScores.breakdown.traffic,
				relationshipScore: nextScores.breakdown.relationship,
				deterministicScore: nextScores.score,
				scoreBreakdown: JSON.stringify(nextScores.breakdown),
				updatedBy: session.user.id,
				updatedAt: new Date(),
			})
			.where(
				and(eq(linkProspects.id, id), eq(linkProspects.clientId, prospect.clientId)),
			)
			.returning();

		return ok(updated ?? null);
	} catch (error) {
		console.error("[links.prospects] patch failed", {
			prospectId: id,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to update link prospect",
		});
	}
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

	const { id } = await context.params;
	const prospect = await loadProspectForAccess(id);
	if (!prospect) {
		return fail(404, { code: "NOT_FOUND", message: "Link prospect not found" });
	}

	const accessContext = await getClientAccessContext(session, prospect.clientId);
	if (!can("links", "edit", { session, clientId: prospect.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const draft = await db
		.select({ id: linkOutreachDrafts.id })
		.from(linkOutreachDrafts)
		.where(
			and(
				eq(linkOutreachDrafts.prospectId, id),
				eq(linkOutreachDrafts.clientId, prospect.clientId),
			),
		)
		.get();

	if (draft) {
		return fail(409, {
			code: "CONFLICT",
			message:
				"Prospect cannot be deleted while linked outreach drafts still exist",
		});
	}

	try {
		await db
			.delete(linkProspects)
			.where(and(eq(linkProspects.id, id), eq(linkProspects.clientId, prospect.clientId)));
		return ok({ id, deleted: true });
	} catch (error) {
		console.error("[links.prospects] delete failed", {
			prospectId: id,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to delete link prospect",
		});
	}
}
