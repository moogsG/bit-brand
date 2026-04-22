import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";
import { getImplementationProposalDetail } from "@/lib/implementation-agent";

const IMPLEMENTATION_QUEUE_PROPOSAL_DETAIL_API_VERSION = "1.0.0" as const;

type ProposalDetailErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "CLIENT_NOT_FOUND"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface ProposalDetailError {
	code: ProposalDetailErrorCode;
	message: string;
	details?: unknown;
}

interface ProposalDetailEnvelope<TData> {
	version: typeof IMPLEMENTATION_QUEUE_PROPOSAL_DETAIL_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ProposalDetailError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ProposalDetailEnvelope<TData>>(
		{
			version: IMPLEMENTATION_QUEUE_PROPOSAL_DETAIL_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: ProposalDetailError) {
	return NextResponse.json<ProposalDetailEnvelope<never>>(
		{
			version: IMPLEMENTATION_QUEUE_PROPOSAL_DETAIL_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const querySchema = z.object({
	clientId: z.string().min(1),
});

interface RouteContext {
	params: Promise<{ id: string }>;
}

async function assertClientExists(clientId: string) {
	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	return Boolean(client);
}

export async function GET(request: NextRequest, context: RouteContext) {
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
	});

	if (!parsedQuery.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsedQuery.error.flatten(),
		});
	}

	const { id } = await context.params;
	const { clientId } = parsedQuery.data;

	if (!(await assertClientExists(clientId))) {
		return fail(404, { code: "CLIENT_NOT_FOUND", message: "Client not found" });
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("technical", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const proposal = await getImplementationProposalDetail({
			clientId,
			proposalId: id,
		});

		if (!proposal) {
			return fail(404, { code: "NOT_FOUND", message: "Proposal not found" });
		}

		return ok({ clientId, proposal }, 200);
	} catch (error) {
		console.error("[implementation-queue.proposal-details] failed", {
			clientId,
			proposalId: id,
			error: error instanceof Error ? error.message : String(error),
		});

		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to load implementation proposal details",
		});
	}
}
