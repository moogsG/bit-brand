import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { isClientEquivalentRole } from "@/lib/auth/role-mapping";
import { db } from "@/lib/db";
import { contentBriefs, contentVersions } from "@/lib/db/schema";
import type { ContentVersion } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const CONTENT_BRIEF_VERSIONS_API_VERSION = "1.0.0" as const;

type ContentBriefVersionsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface ContentBriefVersionsError {
	code: ContentBriefVersionsErrorCode;
	message: string;
	details?: unknown;
}

interface ContentBriefVersionsEnvelope<TData> {
	version: typeof CONTENT_BRIEF_VERSIONS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ContentBriefVersionsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ContentBriefVersionsEnvelope<TData>>(
		{
			version: CONTENT_BRIEF_VERSIONS_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: ContentBriefVersionsError) {
	return NextResponse.json<ContentBriefVersionsEnvelope<never>>(
		{
			version: CONTENT_BRIEF_VERSIONS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const createVersionSchema = z.object({
	body: z.string().trim().min(1),
	diffSummary: z.string().trim().nullable().optional(),
});

function toClientSafeVersion(version: ContentVersion) {
	const { createdBy: _createdBy, ...rest } = version;
	return rest;
}

async function getBriefOrNull(briefId: string) {
	return db
		.select()
		.from(contentBriefs)
		.where(eq(contentBriefs.id, briefId))
		.get();
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ briefId: string }> },
) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Content brief APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const { briefId } = await params;
	const brief = await getBriefOrNull(briefId);
	if (!brief)
		return fail(404, { code: "NOT_FOUND", message: "Brief not found" });

	const accessContext = await getClientAccessContext(session, brief.clientId);
	if (
		!can("content", "view", {
			session,
			clientId: brief.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const rows = await db
			.select()
			.from(contentVersions)
			.where(eq(contentVersions.briefId, briefId))
			.orderBy(desc(contentVersions.version), desc(contentVersions.createdAt))
			.all();

		const role = resolvePermissionRole({ session });
		return ok(
			isClientEquivalentRole(role) ? rows.map(toClientSafeVersion) : rows,
		);
	} catch (error) {
		console.error("[content.brief.versions] list failed", {
			briefId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list brief versions",
		});
	}
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ briefId: string }> },
) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Content brief APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const { briefId } = await params;
	const brief = await getBriefOrNull(briefId);
	if (!brief)
		return fail(404, { code: "NOT_FOUND", message: "Brief not found" });

	const accessContext = await getClientAccessContext(session, brief.clientId);
	if (
		!can("content", "edit", {
			session,
			clientId: brief.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	let parsed: z.infer<typeof createVersionSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createVersionSchema.safeParse(body);
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
		const existingVersions = await db
			.select({ version: contentVersions.version })
			.from(contentVersions)
			.where(eq(contentVersions.briefId, briefId))
			.orderBy(desc(contentVersions.version))
			.all();

		const nextVersion =
			existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;
		const [created] = await db
			.insert(contentVersions)
			.values({
				briefId,
				version: nextVersion,
				body: parsed.body,
				diffSummary: parsed.diffSummary ?? null,
				createdBy: session.user.id ?? null,
				createdAt: new Date(),
			})
			.returning();

		return ok(created ?? null, 201);
	} catch (error) {
		console.error("[content.brief.versions] append failed", {
			briefId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to append brief version",
		});
	}
}
