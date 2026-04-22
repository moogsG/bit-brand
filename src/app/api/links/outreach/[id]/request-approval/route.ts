import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createApprovalRequest } from "@/lib/approvals";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { approvals, linkOutreachDrafts, linkProspects } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import {
	ensureLinkOutreachSendApprovalPolicy,
	LINK_OUTREACH_RESOURCE_TYPE,
	LINK_OUTREACH_SEND_APPROVAL_POLICY_NAME,
} from "@/lib/links/approval-policy";

const LINKS_OUTREACH_REQUEST_APPROVAL_API_VERSION = "1.0.0" as const;

type LinksOutreachRequestApprovalErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "CONFLICT"
	| "INTERNAL_ERROR";

interface LinksOutreachRequestApprovalError {
	code: LinksOutreachRequestApprovalErrorCode;
	message: string;
	details?: unknown;
}

interface LinksOutreachRequestApprovalEnvelope<TData> {
	version: typeof LINKS_OUTREACH_REQUEST_APPROVAL_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LinksOutreachRequestApprovalError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<LinksOutreachRequestApprovalEnvelope<TData>>(
		{
			version: LINKS_OUTREACH_REQUEST_APPROVAL_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: LinksOutreachRequestApprovalError) {
	return NextResponse.json<LinksOutreachRequestApprovalEnvelope<never>>(
		{
			version: LINKS_OUTREACH_REQUEST_APPROVAL_API_VERSION,
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
			prospectId: linkOutreachDrafts.prospectId,
			subject: linkOutreachDrafts.subject,
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
			message: "Sent outreach drafts cannot request approval",
		});
	}

	if (draft.approvalId) {
		const approval = await db
			.select({ status: approvals.status })
			.from(approvals)
			.where(eq(approvals.id, draft.approvalId))
			.get();

		if (approval && (approval.status === "PENDING" || approval.status === "APPROVED")) {
			return fail(409, {
				code: "CONFLICT",
				message: `Approval already ${approval.status.toLowerCase()} for this draft`,
			});
		}
	}

	const prospect = await db
		.select({ domain: linkProspects.domain })
		.from(linkProspects)
		.where(
			and(
				eq(linkProspects.id, draft.prospectId),
				eq(linkProspects.clientId, draft.clientId),
			),
		)
		.get();

	await ensureLinkOutreachSendApprovalPolicy();

	try {
		const approvalId = await createApprovalRequest({
			policyName: LINK_OUTREACH_SEND_APPROVAL_POLICY_NAME,
			resourceType: LINK_OUTREACH_RESOURCE_TYPE,
			resourceId: draft.id,
			clientId: draft.clientId,
			requestedBy: session.user.id,
			metadata: {
				title: `Outreach draft send approval: ${draft.subject}`,
				draftId: draft.id,
				prospectId: draft.prospectId,
				prospectDomain: prospect?.domain ?? null,
				resourceLabel: "Link outreach send approval",
			},
		});

		const now = new Date();
		const [updated] = await db
			.update(linkOutreachDrafts)
			.set({
				approvalId,
				status: "PENDING_APPROVAL",
				requestedApprovalAt: now,
				updatedBy: session.user.id,
				updatedAt: now,
			})
			.where(
				and(
					eq(linkOutreachDrafts.id, draft.id),
					eq(linkOutreachDrafts.clientId, draft.clientId),
				),
			)
			.returning();

		return ok({ draft: updated ?? null, approvalId });
	} catch (error) {
		console.error("[links.outreach.request-approval] failed", {
			draftId: draft.id,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to request outreach approval",
		});
	}
}
