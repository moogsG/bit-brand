import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import { listClientSafeImplementationChanges } from "@/lib/implementation-agent";
import {
	applyImplementationChangeFilters,
	implementationChangeStatuses,
	implementationChangeTypes,
	sortImplementationChangesByUpdatedAt,
} from "@/lib/implementation-agent/client-safe";

const IMPLEMENTATION_QUEUE_CHANGES_API_VERSION = "1.0.0" as const;

type ChangesApiErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "CLIENT_NOT_FOUND"
	| "INTERNAL_ERROR";

interface ChangesApiError {
	code: ChangesApiErrorCode;
	message: string;
	details?: unknown;
}

interface ChangesApiEnvelope<TData> {
	version: typeof IMPLEMENTATION_QUEUE_CHANGES_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ChangesApiError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ChangesApiEnvelope<TData>>(
		{
			version: IMPLEMENTATION_QUEUE_CHANGES_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: ChangesApiError) {
	return NextResponse.json<ChangesApiEnvelope<never>>(
		{
			version: IMPLEMENTATION_QUEUE_CHANGES_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const querySchema = z
	.object({
		clientId: z.string().min(1),
		status: z.enum(["all", ...implementationChangeStatuses]).optional(),
		changeType: z.enum(["all", ...implementationChangeTypes]).optional(),
		search: z.string().trim().max(200).optional(),
		from: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
		to: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
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

const safeChangeSchema = z.object({
	id: z.string(),
	title: z.string(),
	targetRef: z.string().nullable(),
	approvalStatus: z.literal("APPROVED").nullable(),
	execution: z
		.object({
			status: z.enum(["RUNNING", "SUCCEEDED", "FAILED", "ROLLED_BACK"]),
			executedAt: z.string().nullable(),
		})
		.nullable(),
	rollback: z
		.object({
			status: z.enum(["RUNNING", "SUCCEEDED", "FAILED"]),
			rolledBackAt: z.string().nullable(),
		})
		.nullable(),
	updatedAt: z.string().nullable(),
});

function toSafeChanges(changes: readonly unknown[]) {
	return changes
		.map((change) => safeChangeSchema.parse(change))
		.filter(
			(change) =>
				change.approvalStatus === "APPROVED" ||
				Boolean(change.execution) ||
				Boolean(change.rollback),
		);
}

async function assertClientExists(clientId: string) {
	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	return Boolean(client);
}

export async function GET(request: NextRequest) {
	if (!phase3Flags.technicalAgentV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"Implementation queue APIs are disabled in this environment (FF_TECHNICAL_AGENT_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const parsedQuery = querySchema.safeParse({
		clientId: request.nextUrl.searchParams.get("clientId") ?? undefined,
		status: request.nextUrl.searchParams.get("status") ?? undefined,
		changeType:
			request.nextUrl.searchParams.get("changeType") ??
			request.nextUrl.searchParams.get("type") ??
			undefined,
		search: request.nextUrl.searchParams.get("search") ?? undefined,
		from: request.nextUrl.searchParams.get("from") ?? undefined,
		to: request.nextUrl.searchParams.get("to") ?? undefined,
	});

	if (!parsedQuery.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsedQuery.error.flatten(),
		});
	}

	const { clientId, status, changeType, search, from, to } = parsedQuery.data;
	if (!(await assertClientExists(clientId))) {
		return fail(404, { code: "CLIENT_NOT_FOUND", message: "Client not found" });
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("technical", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const changes = await listClientSafeImplementationChanges(clientId);
		const safeChanges = toSafeChanges(changes);
		const filteredChanges = applyImplementationChangeFilters(safeChanges, {
			status,
			type: changeType,
			search,
			from,
			to,
		});

		return ok(
			{
				clientId,
				changes: sortImplementationChangesByUpdatedAt(filteredChanges),
				filters: {
					status: status ?? "all",
					changeType: changeType ?? "all",
					search: search ?? "",
					from: from ?? null,
					to: to ?? null,
				},
			},
			200,
		);
	} catch (error) {
		console.error("[implementation-queue.changes] list failed", {
			clientId,
			error: error instanceof Error ? error.message : String(error),
		});

		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to load implementation changes",
		});
	}
}
