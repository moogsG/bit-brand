import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { implementationProposals } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import { executeImplementationProposalsBatch } from "@/lib/implementation-agent";

const IMPLEMENTATION_QUEUE_BATCH_EXECUTE_API_VERSION = "1.0.0" as const;

type BatchExecuteErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface BatchExecuteError {
	code: BatchExecuteErrorCode;
	message: string;
	details?: unknown;
}

interface BatchExecuteEnvelope<TData> {
	version: typeof IMPLEMENTATION_QUEUE_BATCH_EXECUTE_API_VERSION;
	success: boolean;
	data: TData | null;
	error: BatchExecuteError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<BatchExecuteEnvelope<TData>>(
		{
			version: IMPLEMENTATION_QUEUE_BATCH_EXECUTE_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: BatchExecuteError) {
	return NextResponse.json<BatchExecuteEnvelope<never>>(
		{
			version: IMPLEMENTATION_QUEUE_BATCH_EXECUTE_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const batchExecuteSchema = z.object({
	clientId: z.string().min(1),
	proposalIds: z.array(z.string().min(1)).min(1),
	rerun: z.boolean().optional(),
	dryRun: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
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

	let parsed: z.infer<typeof batchExecuteSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = batchExecuteSchema.safeParse(body);
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
		!can("technical", "edit", {
			session,
			clientId: parsed.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const dedupedIds = [...new Set(parsed.proposalIds)];
	const scopedRows = await db
		.select({ id: implementationProposals.id })
		.from(implementationProposals)
		.where(
			and(
				eq(implementationProposals.clientId, parsed.clientId),
				inArray(implementationProposals.id, dedupedIds),
			),
		)
		.all();

	if (scopedRows.length === 0) {
		return fail(404, {
			code: "NOT_FOUND",
			message: "No matching proposals found for this client",
		});
	}

	const scopedIdSet = new Set(scopedRows.map((row) => row.id));
	const scopedProposalIds = dedupedIds.filter((id) => scopedIdSet.has(id));

	try {
		const batchResult = await executeImplementationProposalsBatch({
			clientId: parsed.clientId,
			proposalIds: scopedProposalIds,
			startedBy: session.user.id,
			rerun: parsed.rerun,
			dryRun: parsed.dryRun,
		});

		return ok({
			clientId: parsed.clientId,
			rerun: parsed.rerun ?? false,
			dryRun: parsed.dryRun,
			dryRunReflection: {
				requested: parsed.dryRun ?? null,
				mixedDefaults: typeof parsed.dryRun !== "boolean",
			},
			summary: batchResult.summary,
			results: batchResult.results.map((result) => ({
				...result,
				dryRunReflection:
					typeof result.effectiveDryRun === "boolean"
						? {
							requested: parsed.dryRun ?? null,
							effective: result.effectiveDryRun,
							provider: result.provider ?? null,
							defaulted: typeof parsed.dryRun !== "boolean",
							defaultedByWordpress:
								typeof parsed.dryRun !== "boolean" &&
								result.provider === "wordpress",
						}
						: null,
			})),
		});
	} catch (error) {
		console.error("[implementation-queue.proposals.batch-execute] failed", {
			clientId: parsed.clientId,
			proposalIds: scopedProposalIds,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to execute implementation proposals",
		});
	}
}
