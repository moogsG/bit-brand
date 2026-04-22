import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { approvals, linkOutreachDrafts } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const LINKS_OUTREACH_SEND_API_VERSION = "1.0.0" as const;

type LinksOutreachSendErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "APPROVAL_REQUIRED"
	| "CONFLICT"
	| "INTERNAL_ERROR";

interface LinksOutreachSendError {
	code: LinksOutreachSendErrorCode;
	message: string;
	details?: unknown;
}

interface LinksOutreachSendEnvelope<TData> {
	version: typeof LINKS_OUTREACH_SEND_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LinksOutreachSendError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<LinksOutreachSendEnvelope<TData>>(
		{
			version: LINKS_OUTREACH_SEND_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: LinksOutreachSendError) {
	return NextResponse.json<LinksOutreachSendEnvelope<never>>(
		{
			version: LINKS_OUTREACH_SEND_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
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
	const draft = await db
		.select({
			id: linkOutreachDrafts.id,
			clientId: linkOutreachDrafts.clientId,
			status: linkOutreachDrafts.status,
			approvalId: linkOutreachDrafts.approvalId,
		})
		.from(linkOutreachDrafts)
		.where(eq(linkOutreachDrafts.id, id))
		.get();

	if (!draft) {
		return fail(404, { code: "NOT_FOUND", message: "Outreach draft not found" });
	}

	const accessContext = await getClientAccessContext(session, draft.clientId);
	if (!can("links", "edit", { session, clientId: draft.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	if (draft.status === "SENT") {
		return fail(409, {
			code: "CONFLICT",
			message: "Outreach draft has already been sent",
		});
	}

	if (!draft.approvalId) {
		return fail(409, {
			code: "APPROVAL_REQUIRED",
			message: "Outreach draft must be approved before sending",
		});
	}

	const approval = await db
		.select({
			id: approvals.id,
			status: approvals.status,
			approvedAt: approvals.approvedAt,
		})
		.from(approvals)
		.where(eq(approvals.id, draft.approvalId))
		.get();

	if (!approval || approval.status !== "APPROVED") {
		return fail(409, {
			code: "APPROVAL_REQUIRED",
			message: "Outreach draft must be approved before sending",
			details: {
				approvalStatus: approval?.status ?? null,
			},
		});
	}

	try {
		const now = new Date();
		const [updated] = await db
			.update(linkOutreachDrafts)
			.set({
				status: "SENT",
				approvedAt: approval.approvedAt ?? now,
				sentAt: now,
				sentBy: session.user.id,
				sendMetadata: JSON.stringify({
					transport: "stub",
					sentAt: now.toISOString(),
					sentBy: session.user.id,
				}),
				updatedBy: session.user.id,
				updatedAt: now,
			})
			.where(
				and(
					eq(linkOutreachDrafts.id, id),
					eq(linkOutreachDrafts.clientId, draft.clientId),
				),
			)
			.returning();

		return ok({ draft: updated ?? null, sent: true });
	} catch (error) {
		console.error("[links.outreach.send] failed", {
			draftId: id,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to send outreach draft",
		});
	}
}
