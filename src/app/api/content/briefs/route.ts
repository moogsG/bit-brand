import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { isClientEquivalentRole } from "@/lib/auth/role-mapping";
import { db } from "@/lib/db";
import { contentBriefs } from "@/lib/db/schema";
import type { ContentBrief } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const CONTENT_BRIEFS_API_VERSION = "1.0.0" as const;

type ContentBriefsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface ContentBriefsError {
	code: ContentBriefsErrorCode;
	message: string;
	details?: unknown;
}

interface ContentBriefsEnvelope<TData> {
	version: typeof CONTENT_BRIEFS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ContentBriefsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ContentBriefsEnvelope<TData>>(
		{ version: CONTENT_BRIEFS_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: ContentBriefsError) {
	return NextResponse.json<ContentBriefsEnvelope<never>>(
		{ version: CONTENT_BRIEFS_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

const createBriefSchema = z.object({
	clientId: z.string().min(1),
	assetId: z.string().min(1).nullable().optional(),
	title: z.string().trim().min(1).max(180),
	primaryKeyword: z.string().trim().min(1).max(180),
	supportingKeywords: z.array(z.string().trim().min(1).max(180)).optional(),
	outline: z.record(z.string(), z.unknown()).optional(),
	clientVisibleSummary: z.string().trim().max(4000).nullable().optional(),
	internalNotes: z.string().trim().max(8000).nullable().optional(),
});

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

export async function GET(request: NextRequest) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message: "Content brief APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const clientId = searchParams.get("clientId");
	if (!clientId) {
		return fail(400, { code: "VALIDATION_ERROR", message: "clientId query param is required" });
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("content", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const rows = await db
			.select()
			.from(contentBriefs)
			.where(eq(contentBriefs.clientId, clientId))
			.orderBy(desc(contentBriefs.updatedAt))
			.all();

		const role = resolvePermissionRole({ session });
		if (isClientEquivalentRole(role)) {
			const approvedOnly = rows
				.filter((row) => row.status === "APPROVED")
				.map((row) => toClientApprovedSummaryBrief(toClientSafeBrief(row)));
			return ok(approvedOnly);
		}

		return ok(rows);
	} catch (error) {
		console.error("[content.briefs] list failed", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to list briefs" });
	}
}

export async function POST(request: NextRequest) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message: "Content brief APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	let parsed: z.infer<typeof createBriefSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createBriefSchema.safeParse(body);
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

	const accessContext = await getClientAccessContext(session, parsed.clientId);
	if (!can("content", "edit", { session, clientId: parsed.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const now = new Date();
		const [created] = await db
			.insert(contentBriefs)
			.values({
				clientId: parsed.clientId,
				assetId: parsed.assetId ?? null,
				title: parsed.title,
				primaryKeyword: parsed.primaryKeyword,
				supportingKeywords: JSON.stringify(parsed.supportingKeywords ?? []),
				outline: JSON.stringify(parsed.outline ?? {}),
				status: "DRAFT",
				clientVisibleSummary: parsed.clientVisibleSummary ?? null,
				internalNotes: parsed.internalNotes ?? null,
				createdBy: session.user.id,
				updatedBy: session.user.id,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return ok(created ?? null, 201);
	} catch (error) {
		console.error("[content.briefs] create failed", {
			clientId: parsed.clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create brief" });
	}
}
