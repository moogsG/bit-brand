import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibilityRuns } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";
import { executeAiVisibilityRun } from "@/lib/ai/visibility-runner";
import { eq } from "drizzle-orm";

const AI_VISIBILITY_RUN_EXECUTE_API_VERSION = "1.0.0" as const;

type ExecuteErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface ExecuteError {
	code: ExecuteErrorCode;
	message: string;
	details?: unknown;
}

interface ExecuteEnvelope<TData> {
	version: typeof AI_VISIBILITY_RUN_EXECUTE_API_VERSION;
	success: boolean;
	data: TData | null;
	error: ExecuteError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<ExecuteEnvelope<TData>>(
		{
			version: AI_VISIBILITY_RUN_EXECUTE_API_VERSION,
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
			version: AI_VISIBILITY_RUN_EXECUTE_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ runId: string }> },
) {
	if (!phase2Flags.aiVisibilityV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"AI visibility run APIs are disabled in this environment (FF_AI_VISIBILITY_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const { runId } = await params;
	try {
		const run = await db
			.select({ id: aiVisibilityRuns.id, clientId: aiVisibilityRuns.clientId })
			.from(aiVisibilityRuns)
			.where(eq(aiVisibilityRuns.id, runId))
			.get();

		if (!run) {
			return fail(404, { code: "NOT_FOUND", message: "Run not found" });
		}

		const accessContext = await getClientAccessContext(session, run.clientId);
		if (!can("aiVisibility", "edit", { session, clientId: run.clientId, ...accessContext })) {
			return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
		}

		const result = await executeAiVisibilityRun(runId);
		return ok(result);
	} catch (err) {
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to execute run",
			details: err instanceof Error ? err.message : String(err),
		});
	}
}
