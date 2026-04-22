import { and, desc, eq, gte, lte, or, type SQL } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import {
	contentCalendarItems,
	contentCalendarWorkflowStatuses,
} from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const CONTENT_CALENDAR_API_VERSION = "1.0.0" as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type ContentCalendarErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface ContentCalendarError {
	code: ContentCalendarErrorCode;
	message: string;
	details?: unknown;
}

interface ContentCalendarEnvelope<TData> {
	version: typeof CONTENT_CALENDAR_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ContentCalendarError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ContentCalendarEnvelope<TData>>(
		{ version: CONTENT_CALENDAR_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: ContentCalendarError) {
	return NextResponse.json<ContentCalendarEnvelope<never>>(
		{
			version: CONTENT_CALENDAR_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const getQuerySchema = z
	.object({
		clientId: z.string().min(1),
		from: z.string().regex(datePattern).optional(),
		to: z.string().regex(datePattern).optional(),
		status: z.enum(contentCalendarWorkflowStatuses).optional(),
	})
	.superRefine((input, ctx) => {
		if (input.from && input.to && input.from > input.to) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "from must be less than or equal to to",
				path: ["from"],
			});
		}
	});

const createItemSchema = z.object({
	clientId: z.string().min(1),
	briefId: z.string().min(1).nullable().optional(),
	title: z.string().trim().min(1).max(200),
	ownerUserId: z.string().min(1).nullable().optional(),
	dueDate: z.string().regex(datePattern).nullable().optional(),
	publishDate: z.string().regex(datePattern).nullable().optional(),
	workflowStatus: z.enum(contentCalendarWorkflowStatuses).optional(),
});

function buildDateWindowCondition(from?: string, to?: string): SQL | undefined {
	if (!from && !to) return undefined;

	const dueRange: SQL[] = [];
	if (from) dueRange.push(gte(contentCalendarItems.dueDate, from));
	if (to) dueRange.push(lte(contentCalendarItems.dueDate, to));

	const publishRange: SQL[] = [];
	if (from) publishRange.push(gte(contentCalendarItems.publishDate, from));
	if (to) publishRange.push(lte(contentCalendarItems.publishDate, to));

	const branches: SQL[] = [];
	if (dueRange.length > 0) branches.push(and(...dueRange) as SQL);
	if (publishRange.length > 0) branches.push(and(...publishRange) as SQL);

	if (branches.length === 0) return undefined;
	if (branches.length === 1) return branches[0];
	return or(...branches) as SQL;
}

export async function GET(request: NextRequest) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Content calendar APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const searchParams =
		request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = getQuerySchema.safeParse({
		clientId: searchParams.get("clientId") ?? undefined,
		from: searchParams.get("from") ?? undefined,
		to: searchParams.get("to") ?? undefined,
		status: searchParams.get("status") ?? undefined,
	});

	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, from, to, status } = parsed.data;

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("content", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const conditions: SQL[] = [eq(contentCalendarItems.clientId, clientId)];
		if (status) {
			conditions.push(eq(contentCalendarItems.workflowStatus, status));
		}

		const dateWindowCondition = buildDateWindowCondition(from, to);
		if (dateWindowCondition) {
			conditions.push(dateWindowCondition);
		}

		const rows = await db
			.select()
			.from(contentCalendarItems)
			.where(and(...conditions))
			.orderBy(desc(contentCalendarItems.updatedAt))
			.all();

		return ok(rows);
	} catch (error) {
		console.error("[content.calendar] list failed", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list content calendar items",
		});
	}
}

export async function POST(request: NextRequest) {
	if (!phase3Flags.contentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Content calendar APIs are disabled in this environment (FF_CONTENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	let parsed: z.infer<typeof createItemSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createItemSchema.safeParse(body);
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
	if (
		!can("content", "edit", {
			session,
			clientId: parsed.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const now = new Date();
		const [created] = await db
			.insert(contentCalendarItems)
			.values({
				clientId: parsed.clientId,
				briefId: parsed.briefId ?? null,
				title: parsed.title,
				ownerUserId: parsed.ownerUserId ?? null,
				dueDate: parsed.dueDate ?? null,
				publishDate: parsed.publishDate ?? null,
				workflowStatus: parsed.workflowStatus ?? "BACKLOG",
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return ok(created ?? null, 201);
	} catch (error) {
		console.error("[content.calendar] create failed", {
			clientId: parsed.clientId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create content calendar item",
		});
	}
}
