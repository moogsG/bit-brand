import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { implementationExecutions } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import {
	ImplementationAgentError,
	rollbackImplementationExecution,
} from "@/lib/implementation-agent";

const IMPLEMENTATION_QUEUE_ROLLBACK_API_VERSION = "1.0.0" as const;

type RollbackErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "CONFLICT"
	| "INTERNAL_ERROR";

interface RollbackError {
	code: RollbackErrorCode;
	message: string;
	details?: unknown;
}

interface RollbackEnvelope<TData> {
	version: typeof IMPLEMENTATION_QUEUE_ROLLBACK_API_VERSION;
	success: boolean;
	data: TData | null;
	error: RollbackError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<RollbackEnvelope<TData>>(
		{
			version: IMPLEMENTATION_QUEUE_ROLLBACK_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: RollbackError) {
	return NextResponse.json<RollbackEnvelope<never>>(
		{
			version: IMPLEMENTATION_QUEUE_ROLLBACK_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const rollbackSchema = z.object({
	reason: z.string().trim().max(2_000).optional(),
});

interface RouteContext {
	params: Promise<{ executionId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

	const { executionId } = await context.params;

	let parsed: z.infer<typeof rollbackSchema>;
	try {
		const body = (await request.json().catch(() => ({}))) as unknown;
		const validation = rollbackSchema.safeParse(body);
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

	const execution = await db
		.select({
			id: implementationExecutions.id,
			clientId: implementationExecutions.clientId,
		})
		.from(implementationExecutions)
		.where(eq(implementationExecutions.id, executionId))
		.get();

	if (!execution) {
		return fail(404, { code: "NOT_FOUND", message: "Execution not found" });
	}

	const accessContext = await getClientAccessContext(
		session,
		execution.clientId,
	);
	if (
		!can("technical", "edit", {
			session,
			clientId: execution.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const result = await rollbackImplementationExecution({
			executionId,
			requestedBy: session.user.id,
			reason: parsed.reason,
		});

		if (result.rollback.status === "FAILED") {
			return fail(409, {
				code: "CONFLICT",
				message: result.rollback.error ?? "Rollback failed",
				details: { rollbackId: result.rollback.id },
			});
		}

		return ok(result, 200);
	} catch (error) {
		if (error instanceof ImplementationAgentError) {
			if (error.code === "NOT_FOUND") {
				return fail(404, { code: "NOT_FOUND", message: error.message });
			}

			if (error.code === "INVALID_STATE") {
				return fail(409, { code: "CONFLICT", message: error.message });
			}
		}

		console.error("[implementation-queue.executions.rollback] failed", {
			executionId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to rollback implementation execution",
		});
	}
}
