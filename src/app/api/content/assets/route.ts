import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { isClientEquivalentRole } from "@/lib/auth/role-mapping";
import { db } from "@/lib/db";
import { contentAssets } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const CONTENT_ASSETS_API_VERSION = "1.0.0" as const;

type ContentAssetsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface ContentAssetsError {
	code: ContentAssetsErrorCode;
	message: string;
	details?: unknown;
}

interface ContentAssetsEnvelope<TData> {
	version: typeof CONTENT_ASSETS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ContentAssetsError | null;
}

function buildSuccessResponse<TData>(data: TData) {
	return NextResponse.json<ContentAssetsEnvelope<TData>>({
		version: CONTENT_ASSETS_API_VERSION,
		success: true,
		data,
		error: null,
	});
}

function buildErrorResponse(status: number, error: ContentAssetsError) {
	return NextResponse.json<ContentAssetsEnvelope<never>>(
		{
			version: CONTENT_ASSETS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

export async function GET(request: NextRequest) {
	if (!phase3Flags.contentV1()) {
		return buildErrorResponse(404, {
			code: "MODULE_DISABLED",
			message: "Content asset APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return buildErrorResponse(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const clientId = searchParams.get("clientId");
	if (!clientId) {
		return buildErrorResponse(400, {
			code: "VALIDATION_ERROR",
			message: "clientId query param is required",
		});
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("content", "view", { session, clientId, ...accessContext })) {
		return buildErrorResponse(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const rows = await db
			.select()
			.from(contentAssets)
			.where(eq(contentAssets.clientId, clientId))
			.all();

		const role = resolvePermissionRole({ session });
		if (!isClientEquivalentRole(role)) {
			return buildSuccessResponse(rows);
		}

		// Client-safe subset: omit metadata and internal-only fields.
		const clientSafe = rows.map((row) => ({
			id: row.id,
			clientId: row.clientId,
			url: row.url,
			title: row.title,
			contentType: row.contentType,
			status: row.status,
			canonicalUrl: row.canonicalUrl,
			publishedAt: row.publishedAt,
			lastCrawledAt: row.lastCrawledAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}));

		return buildSuccessResponse(clientSafe);
	} catch (error) {
		console.error("[content.assets] failed", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return buildErrorResponse(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list content assets",
		});
	}
}
