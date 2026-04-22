import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { backlinkInventory, backlinkInventoryStatuses } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const LINKS_BACKLINKS_API_VERSION = "1.0.0" as const;

type LinksBacklinksErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface LinksBacklinksError {
	code: LinksBacklinksErrorCode;
	message: string;
	details?: unknown;
}

interface LinksBacklinksEnvelope<TData> {
	version: typeof LINKS_BACKLINKS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LinksBacklinksError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<LinksBacklinksEnvelope<TData>>(
		{
			version: LINKS_BACKLINKS_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: LinksBacklinksError) {
	return NextResponse.json<LinksBacklinksEnvelope<never>>(
		{
			version: LINKS_BACKLINKS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const getQuerySchema = z.object({
	clientId: z.string().min(1),
	status: z.enum(backlinkInventoryStatuses).optional(),
	domain: z.string().trim().min(1).optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
});

const importBacklinksSchema = z.object({
	clientId: z.string().min(1),
	source: z.string().trim().min(1).max(128).optional(),
	notes: z.string().trim().max(500).optional(),
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
	const parsed = getQuerySchema.safeParse({
		clientId: searchParams.get("clientId") ?? undefined,
		status: searchParams.get("status") ?? undefined,
		domain: searchParams.get("domain") ?? undefined,
		from: searchParams.get("from") ?? undefined,
		to: searchParams.get("to") ?? undefined,
	});

	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, status, domain, from, to } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("links", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const conditions: SQL[] = [eq(backlinkInventory.clientId, clientId)];
		if (status) {
			conditions.push(eq(backlinkInventory.status, status));
		}
		if (domain) {
			conditions.push(eq(backlinkInventory.sourceDomain, domain));
		}
		if (from) {
			conditions.push(gte(backlinkInventory.lastSeenAt, from));
		}
		if (to) {
			conditions.push(lte(backlinkInventory.lastSeenAt, to));
		}

		const rows = await db
			.select()
			.from(backlinkInventory)
			.where(and(...conditions))
			.orderBy(
				desc(backlinkInventory.lastSeenAt),
				desc(backlinkInventory.updatedAt),
			)
			.all();

		return ok(rows);
	} catch (error) {
		console.error("[links.backlinks] list failed", {
			clientId,
			status,
			domain,
			from,
			to,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list backlink inventory",
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

	let parsed: z.infer<typeof importBacklinksSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = importBacklinksSchema.safeParse(body);
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

	return ok(
		{
			status: "placeholder",
			accepted: true,
			clientId: parsed.clientId,
			source: parsed.source ?? null,
			notes: parsed.notes ?? null,
			message:
				"Backlink import/sync placeholder only. No rows were imported. Connect provider sync in a future iteration.",
		},
		202,
	);
}
