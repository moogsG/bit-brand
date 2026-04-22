import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import {
	approvals,
	linkOutreachDraftStatuses,
	linkOutreachDrafts,
	linkProspects,
} from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const LINKS_OUTREACH_API_VERSION = "1.0.0" as const;

type LinksOutreachErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface LinksOutreachError {
	code: LinksOutreachErrorCode;
	message: string;
	details?: unknown;
}

interface LinksOutreachEnvelope<TData> {
	version: typeof LINKS_OUTREACH_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LinksOutreachError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<LinksOutreachEnvelope<TData>>(
		{
			version: LINKS_OUTREACH_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: LinksOutreachError) {
	return NextResponse.json<LinksOutreachEnvelope<never>>(
		{
			version: LINKS_OUTREACH_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const listQuerySchema = z.object({
	clientId: z.string().min(1),
	status: z.enum(linkOutreachDraftStatuses).optional(),
});

const createSchema = z.object({
	clientId: z.string().min(1),
	prospectId: z.string().min(1),
	subject: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(20000),
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
	const parsed = listQuerySchema.safeParse({
		clientId: searchParams.get("clientId") ?? undefined,
		status: searchParams.get("status") ?? undefined,
	});

	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, status } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("links", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const conditions = [eq(linkOutreachDrafts.clientId, clientId)];
		if (status) {
			conditions.push(eq(linkOutreachDrafts.status, status));
		}

		const rows = await db
			.select({
				id: linkOutreachDrafts.id,
				clientId: linkOutreachDrafts.clientId,
				prospectId: linkOutreachDrafts.prospectId,
				subject: linkOutreachDrafts.subject,
				body: linkOutreachDrafts.body,
				status: linkOutreachDrafts.status,
				approvalId: linkOutreachDrafts.approvalId,
				requestedApprovalAt: linkOutreachDrafts.requestedApprovalAt,
				approvedAt: linkOutreachDrafts.approvedAt,
				sentAt: linkOutreachDrafts.sentAt,
				sentBy: linkOutreachDrafts.sentBy,
				sendMetadata: linkOutreachDrafts.sendMetadata,
				createdBy: linkOutreachDrafts.createdBy,
				updatedBy: linkOutreachDrafts.updatedBy,
				createdAt: linkOutreachDrafts.createdAt,
				updatedAt: linkOutreachDrafts.updatedAt,
				prospectDomain: linkProspects.domain,
				approvalStatus: approvals.status,
			})
			.from(linkOutreachDrafts)
			.innerJoin(linkProspects, eq(linkOutreachDrafts.prospectId, linkProspects.id))
			.leftJoin(approvals, eq(linkOutreachDrafts.approvalId, approvals.id))
			.where(and(...conditions))
			.orderBy(desc(linkOutreachDrafts.updatedAt))
			.all();

		return ok(
			rows.map((row) => ({
				...row,
				status:
					row.status !== "SENT" && row.approvalStatus === "APPROVED"
						? "APPROVED"
						: row.status,
			})),
		);
	} catch (error) {
		console.error("[links.outreach] list failed", {
			clientId,
			status,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list outreach drafts",
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

	const prospect = await db
		.select({ id: linkProspects.id })
		.from(linkProspects)
		.where(
			and(
				eq(linkProspects.id, parsed.prospectId),
				eq(linkProspects.clientId, parsed.clientId),
			),
		)
		.get();

	if (!prospect) {
		return fail(404, {
			code: "NOT_FOUND",
			message: "Prospect not found for this client",
		});
	}

	try {
		const now = new Date();
		const [created] = await db
			.insert(linkOutreachDrafts)
			.values({
				clientId: parsed.clientId,
				prospectId: parsed.prospectId,
				subject: parsed.subject,
				body: parsed.body,
				status: "DRAFT",
				sendMetadata: JSON.stringify({ transport: "stub", state: "draft" }),
				createdBy: session.user.id,
				updatedBy: session.user.id,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return ok(created ?? null, 201);
	} catch (error) {
		console.error("[links.outreach] create failed", {
			clientId: parsed.clientId,
			prospectId: parsed.prospectId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create outreach draft",
		});
	}
}
