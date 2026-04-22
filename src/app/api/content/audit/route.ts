import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeContentAuditFindings } from "@/lib/content/audit";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { contentAssets, contentAuditFindings } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const CONTENT_AUDIT_API_VERSION = "1.0.0" as const;

type ContentAuditErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface ContentAuditError {
	code: ContentAuditErrorCode;
	message: string;
	details?: unknown;
}

interface ContentAuditEnvelope<TData> {
	version: typeof CONTENT_AUDIT_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ContentAuditError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ContentAuditEnvelope<TData>>(
		{ version: CONTENT_AUDIT_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: ContentAuditError) {
	return NextResponse.json<ContentAuditEnvelope<never>>(
		{ version: CONTENT_AUDIT_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

const requestSchema = z.object({
	clientId: z.string().min(1),
});

const querySchema = z.object({
	clientId: z.string().min(1),
	recommendationType: z
		.enum(["REFRESH", "CONSOLIDATE", "DELETE", "RETARGET"])
		.optional(),
	severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
});

export async function GET(request: NextRequest) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message: "Content audit APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const validation = querySchema.safeParse({
		clientId: request.nextUrl.searchParams.get("clientId") ?? undefined,
		recommendationType:
			request.nextUrl.searchParams.get("recommendationType") ?? undefined,
		severity: request.nextUrl.searchParams.get("severity") ?? undefined,
	});

	if (!validation.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: validation.error.flatten(),
		});
	}

	const { clientId, recommendationType, severity } = validation.data;

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("content", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const conditions = [eq(contentAuditFindings.clientId, clientId)];
		if (recommendationType) {
			conditions.push(
				eq(contentAuditFindings.recommendationType, recommendationType),
			);
		}
		if (severity) {
			conditions.push(eq(contentAuditFindings.severity, severity));
		}

		const findings = await db
			.select()
			.from(contentAuditFindings)
			.where(and(...conditions))
			.all();

		const sorted = [...findings].sort((a, b) => {
			const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
			const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
			if (aCreated !== bCreated) {
				return bCreated - aCreated;
			}

			const aKey = `${a.assetId}:${a.recommendationType}:${a.severity}`;
			const bKey = `${b.assetId}:${b.recommendationType}:${b.severity}`;
			return aKey.localeCompare(bKey);
		});

		return ok({ findings: sorted, count: sorted.length });
	} catch (error) {
		console.error("[content.audit] failed to load findings", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to load content audit findings",
		});
	}
}

export async function POST(request: NextRequest) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message: "Content audit APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	let parsed: z.infer<typeof requestSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = requestSchema.safeParse(body);
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
	if (!can("content", "edit", { session, clientId: parsed.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const assets = await db
			.select()
			.from(contentAssets)
			.where(eq(contentAssets.clientId, parsed.clientId))
			.all();

		const computed = computeContentAuditFindings({ assets, now: new Date() });

		// Replace findings for client to keep state deterministic.
		await db.delete(contentAuditFindings).where(eq(contentAuditFindings.clientId, parsed.clientId)).run();

		if (computed.length === 0) {
			return ok({ inserted: 0, findings: [] });
		}

		const inserted = await db
			.insert(contentAuditFindings)
			.values(
				computed.map((finding) => ({
					clientId: parsed.clientId,
					assetId: finding.assetId,
					recommendationType: finding.recommendationType,
					severity: finding.severity,
					reason: finding.reason,
					proposedChanges: JSON.stringify(finding.proposedChanges),
					createdBy: session.user.id,
				})),
			)
			.returning();

		// Stable ordering for UI rendering.
		const sorted = [...inserted].sort((a, b) => {
			const aKey = `${a.assetId}:${a.recommendationType}:${a.severity}`;
			const bKey = `${b.assetId}:${b.recommendationType}:${b.severity}`;
			return aKey.localeCompare(bKey);
		});

		return ok({ inserted: sorted.length, findings: sorted }, 201);
	} catch (error) {
		console.error("[content.audit] failed", {
			clientId: parsed.clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to compute content audit" });
	}
}
