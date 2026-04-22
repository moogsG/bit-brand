import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { implementationProposals } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import { isImplementationProviderName } from "@/lib/implementation-agent/providers";
import {
	executeImplementationProposal,
	ImplementationAgentError,
} from "@/lib/implementation-agent";

const IMPLEMENTATION_QUEUE_EXECUTE_API_VERSION = "1.0.0" as const;

type ExecuteErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "APPROVAL_REQUIRED"
	| "CONFLICT"
	| "INTERNAL_ERROR";

interface ExecuteError {
	code: ExecuteErrorCode;
	message: string;
	details?: unknown;
}

interface ExecuteEnvelope<TData> {
	version: typeof IMPLEMENTATION_QUEUE_EXECUTE_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ExecuteError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ExecuteEnvelope<TData>>(
		{
			version: IMPLEMENTATION_QUEUE_EXECUTE_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: ExecuteError) {
	return NextResponse.json<ExecuteEnvelope<never>>(
		{
			version: IMPLEMENTATION_QUEUE_EXECUTE_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const executeSchema = z.object({
	provider: z
		.string()
		.trim()
		.min(1)
		.max(64)
		.refine((value) => isImplementationProviderName(value), {
			message: "Unsupported provider",
		})
		.optional(),
	rerun: z.boolean().optional(),
	dryRun: z.boolean().optional(),
});

interface RouteContext {
	params: Promise<{ id: string }>;
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

	const { id } = await context.params;

	let parsed: z.infer<typeof executeSchema>;
	try {
		const body = (await request.json().catch(() => ({}))) as unknown;
		const validation = executeSchema.safeParse(body);
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

	const proposal = await db
		.select({
			id: implementationProposals.id,
			clientId: implementationProposals.clientId,
			provider: implementationProposals.provider,
		})
		.from(implementationProposals)
		.where(eq(implementationProposals.id, id))
		.get();

	if (!proposal) {
		return fail(404, { code: "NOT_FOUND", message: "Proposal not found" });
	}

	const accessContext = await getClientAccessContext(
		session,
		proposal.clientId,
	);
	if (
		!can("technical", "edit", {
			session,
			clientId: proposal.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const effectiveProvider = parsed.provider ?? proposal.provider;
	const defaultedByWordpress =
		typeof parsed.dryRun !== "boolean" && effectiveProvider === "wordpress";
	const resolvedDryRun =
		typeof parsed.dryRun === "boolean"
			? parsed.dryRun
			: defaultedByWordpress
				? true
				: undefined;

	if (parsed.provider) {
		await db
			.update(implementationProposals)
			.set({ provider: parsed.provider, updatedAt: new Date() })
			.where(eq(implementationProposals.id, id));
	}

	try {
		const result = await executeImplementationProposal({
			proposalId: id,
			startedBy: session.user.id,
			rerun: parsed.rerun,
			dryRun: resolvedDryRun,
		});

		if (result.execution.status === "FAILED") {
			return fail(409, {
				code: "CONFLICT",
				message: result.execution.error ?? "Execution failed",
				details: { executionId: result.execution.id },
			});
		}

		return ok(
			{
				...result,
				dryRunReflection: {
					requested: parsed.dryRun ?? null,
					effective: result.effectiveDryRun,
					provider: result.provider,
					defaulted: typeof parsed.dryRun !== "boolean",
					defaultedByWordpress,
				},
			},
			200,
		);
	} catch (error) {
		if (error instanceof ImplementationAgentError) {
			if (error.code === "NOT_FOUND") {
				return fail(404, { code: "NOT_FOUND", message: error.message });
			}

			if (error.code === "VALIDATION_ERROR") {
				return fail(400, {
					code: "VALIDATION_ERROR",
					message: error.message,
				});
			}

			if (error.code === "APPROVAL_REQUIRED") {
				return fail(409, { code: "APPROVAL_REQUIRED", message: error.message });
			}

			if (error.code === "ALREADY_EXECUTED") {
				return fail(409, {
					code: "CONFLICT",
					message: error.message,
					details: { conflict: "ALREADY_EXECUTED" },
				});
			}

			if (error.code === "INVALID_STATE") {
				return fail(409, { code: "CONFLICT", message: error.message });
			}
		}

		console.error("[implementation-queue.proposals.execute] failed", {
			proposalId: id,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to execute implementation proposal",
		});
	}
}
