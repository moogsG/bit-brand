import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApprovalRequest, hasPendingApproval } from "@/lib/approvals";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { isClientEquivalentRole } from "@/lib/auth/role-mapping";
import { db } from "@/lib/db";
import { contentBriefs } from "@/lib/db/schema";
import type { ContentBrief } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const CONTENT_BRIEF_API_VERSION = "1.0.0" as const;

type ContentBriefErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "POLICY_MISSING"
	| "INTERNAL_ERROR";

interface ContentBriefError {
	code: ContentBriefErrorCode;
	message: string;
	details?: unknown;
}

interface ContentBriefEnvelope<TData> {
	version: typeof CONTENT_BRIEF_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ContentBriefError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ContentBriefEnvelope<TData>>(
		{ version: CONTENT_BRIEF_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: ContentBriefError) {
	return NextResponse.json<ContentBriefEnvelope<never>>(
		{ version: CONTENT_BRIEF_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

const updateBriefSchema = z
	.object({
		assetId: z.string().min(1).nullable().optional(),
		title: z.string().trim().min(1).max(180).optional(),
		primaryKeyword: z.string().trim().min(1).max(180).optional(),
		supportingKeywords: z.array(z.string().trim().min(1).max(180)).optional(),
		outline: z.record(z.string(), z.unknown()).optional(),
		status: z
			.enum([
				"DRAFT",
				"AWAITING_CLIENT_INPUT",
				"READY_FOR_APPROVAL",
				"APPROVED",
				"IN_PROGRESS",
				"DONE",
			])
			.optional(),
		clientVisibleSummary: z.string().trim().max(4000).nullable().optional(),
		internalNotes: z.string().trim().max(8000).nullable().optional(),
	})
	.strict();

function toClientSafeBrief(brief: ContentBrief) {
	const { internalNotes: _internalNotes, updatedBy: _updatedBy, createdBy: _createdBy, ...rest } =
		brief;
	return rest;
}

function toClientApprovedSummaryBrief(
	brief: Pick<
		ContentBrief,
		| "id"
		| "clientId"
		| "title"
		| "primaryKeyword"
		| "status"
		| "clientVisibleSummary"
		| "createdAt"
		| "updatedAt"
	>,
) {
	return {
		id: brief.id,
		clientId: brief.clientId,
		title: brief.title,
		primaryKeyword: brief.primaryKeyword,
		status: brief.status,
		clientVisibleSummary: brief.clientVisibleSummary,
		createdAt: brief.createdAt,
		updatedAt: brief.updatedAt,
	};
}

async function getBriefOrNull(briefId: string) {
	return db.select().from(contentBriefs).where(eq(contentBriefs.id, briefId)).get();
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ briefId: string }> },
) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message: "Content brief APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const { briefId } = await params;
	const brief = await getBriefOrNull(briefId);
	if (!brief) return fail(404, { code: "NOT_FOUND", message: "Brief not found" });

	const accessContext = await getClientAccessContext(session, brief.clientId);
	if (!can("content", "view", { session, clientId: brief.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const role = resolvePermissionRole({ session });
	if (isClientEquivalentRole(role)) {
		if (brief.status !== "APPROVED") {
			return fail(404, { code: "NOT_FOUND", message: "Brief not found" });
		}

		return ok(toClientApprovedSummaryBrief(toClientSafeBrief(brief)));
	}

	return ok(brief);
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ briefId: string }> },
) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message: "Content brief APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const { briefId } = await params;
	const existing = await getBriefOrNull(briefId);
	if (!existing) return fail(404, { code: "NOT_FOUND", message: "Brief not found" });

	const accessContext = await getClientAccessContext(session, existing.clientId);
	if (!can("content", "edit", { session, clientId: existing.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	let parsed: z.infer<typeof updateBriefSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = updateBriefSchema.safeParse(body);
		if (!validation.success) {
			return fail(400, {
				code: "VALIDATION_ERROR",
				message: "Invalid request payload",
				details: validation.error.flatten(),
			});
		}
		parsed = validation.data;
	} catch {
		return fail(400, { code: "VALIDATION_ERROR", message: "Request body must be valid JSON" });
	}

	const now = new Date();

	try {
		const nextStatus = parsed.status ?? existing.status;
		const transitionedToReady =
			nextStatus === "READY_FOR_APPROVAL" && existing.status !== "READY_FOR_APPROVAL";

		const [updated] = await db
			.update(contentBriefs)
			.set({
				assetId: parsed.assetId ?? existing.assetId,
				title: parsed.title ?? existing.title,
				primaryKeyword: parsed.primaryKeyword ?? existing.primaryKeyword,
				supportingKeywords:
					parsed.supportingKeywords !== undefined
						? JSON.stringify(parsed.supportingKeywords)
						: existing.supportingKeywords,
				outline:
					parsed.outline !== undefined ? JSON.stringify(parsed.outline) : existing.outline,
				status: nextStatus,
				clientVisibleSummary:
					parsed.clientVisibleSummary !== undefined
						? parsed.clientVisibleSummary
						: existing.clientVisibleSummary,
				internalNotes:
					parsed.internalNotes !== undefined ? parsed.internalNotes : existing.internalNotes,
				updatedBy: session.user.id,
				updatedAt: now,
			})
			.where(and(eq(contentBriefs.id, briefId)))
			.returning();

		if (transitionedToReady) {
			const alreadyPending = await hasPendingApproval("CONTENT_BRIEF", briefId);
			if (!alreadyPending) {
				try {
					await createApprovalRequest({
						policyName: "content_brief_approve",
						resourceType: "CONTENT_BRIEF",
						resourceId: briefId,
						clientId: existing.clientId,
						requestedBy: session.user.id,
						metadata: {
							briefTitle: updated?.title ?? existing.title,
						},
					});
				} catch (error) {
					return fail(500, {
						code: "POLICY_MISSING",
						message:
							"Approval policy missing or invalid for content brief approval (content_brief_approve)",
						details: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}

		return ok(updated ?? null);
	} catch (error) {
		console.error("[content.briefs] update failed", {
			briefId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update brief" });
	}
}
