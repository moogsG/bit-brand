import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { implementationProposals } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import { requestImplementationProposalApprovals } from "@/lib/implementation-agent";

const IMPLEMENTATION_QUEUE_REQUEST_APPROVAL_API_VERSION = "1.0.0" as const;

type RequestApprovalErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface RequestApprovalError {
	code: RequestApprovalErrorCode;
	message: string;
	details?: unknown;
}

interface RequestApprovalEnvelope<TData> {
	version: typeof IMPLEMENTATION_QUEUE_REQUEST_APPROVAL_API_VERSION;
	success: boolean;
	data: TData | null;
	error: RequestApprovalError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<RequestApprovalEnvelope<TData>>(
		{
			version: IMPLEMENTATION_QUEUE_REQUEST_APPROVAL_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: RequestApprovalError) {
	return NextResponse.json<RequestApprovalEnvelope<never>>(
		{
			version: IMPLEMENTATION_QUEUE_REQUEST_APPROVAL_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const requestApprovalSchema = z
	.object({
		clientId: z.string().min(1),
		proposalId: z.string().min(1).optional(),
		proposalIds: z.array(z.string().min(1)).min(1).optional(),
	})
	.superRefine((value, ctx) => {
		if (
			!value.proposalId &&
			(!value.proposalIds || value.proposalIds.length === 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "proposalId or proposalIds is required",
				path: ["proposalIds"],
			});
		}
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

	let parsed: z.infer<typeof requestApprovalSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = requestApprovalSchema.safeParse(body);
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

	const proposalIds = [
		...(parsed.proposalId ? [parsed.proposalId] : []),
		...(parsed.proposalIds ?? []),
	];
	const dedupedProposalIds = [...new Set(proposalIds)];

	const scopedProposals = await db
		.select({ id: implementationProposals.id })
		.from(implementationProposals)
		.where(
			and(
				eq(implementationProposals.clientId, parsed.clientId),
				inArray(implementationProposals.id, dedupedProposalIds),
			),
		)
		.all();

	const validIds = new Set(scopedProposals.map((row) => row.id));
	const scopedProposalIds = dedupedProposalIds.filter((id) => validIds.has(id));
	if (scopedProposalIds.length === 0) {
		return fail(404, {
			code: "NOT_FOUND",
			message: "No matching proposals found for this client",
		});
	}

	try {
		const approvalRequest = await requestImplementationProposalApprovals({
			clientId: parsed.clientId,
			proposalIds: scopedProposalIds,
			requestedBy: session.user.id,
		});

		return ok({
			clientId: parsed.clientId,
			sharedApprovalId: approvalRequest.sharedApprovalId,
			requestedCount: approvalRequest.requestedCount,
			skippedCount: approvalRequest.skippedCount,
			results: approvalRequest.results,
		});
	} catch (error) {
		console.error("[implementation-queue.proposals.request-approval] failed", {
			clientId: parsed.clientId,
			proposalIds: scopedProposalIds,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to request proposal approval",
		});
	}
}
