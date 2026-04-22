import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { linkOutreachDrafts } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const LINKS_OUTREACH_DETAIL_API_VERSION = "1.0.0" as const;

type LinksOutreachDetailErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "CONFLICT"
	| "INTERNAL_ERROR";

interface LinksOutreachDetailError {
	code: LinksOutreachDetailErrorCode;
	message: string;
	details?: unknown;
}

interface LinksOutreachDetailEnvelope<TData> {
	version: typeof LINKS_OUTREACH_DETAIL_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LinksOutreachDetailError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<LinksOutreachDetailEnvelope<TData>>(
		{
			version: LINKS_OUTREACH_DETAIL_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: LinksOutreachDetailError) {
	return NextResponse.json<LinksOutreachDetailEnvelope<never>>(
		{
			version: LINKS_OUTREACH_DETAIL_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const patchSchema = z.object({
	subject: z.string().trim().min(1).max(200).optional(),
	body: z.string().trim().min(1).max(20000).optional(),
});

interface RouteContext {
	params: Promise<{ id: string }>;
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
	const draft = await db
		.select({
			id: linkOutreachDrafts.id,
			clientId: linkOutreachDrafts.clientId,
			status: linkOutreachDrafts.status,
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
			message: "Sent outreach drafts are immutable",
		});
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
		const [updated] = await db
			.update(linkOutreachDrafts)
			.set({
				subject: parsed.subject,
				body: parsed.body,
				updatedBy: session.user.id,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(linkOutreachDrafts.id, id),
					eq(linkOutreachDrafts.clientId, draft.clientId),
				),
			)
			.returning();

		return ok(updated ?? null);
	} catch (error) {
		console.error("[links.outreach] patch failed", {
			draftId: id,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to update outreach draft",
		});
	}
}
