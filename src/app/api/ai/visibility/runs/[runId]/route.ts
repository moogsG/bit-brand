import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibilityRunResults, aiVisibilityRuns } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";
import { getAiVisibilityRunSummary } from "@/lib/ai/visibility-runner";

const AI_VISIBILITY_RUN_API_VERSION = "1.0.0" as const;

type RunErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface RunError {
	code: RunErrorCode;
	message: string;
	details?: unknown;
}

interface RunEnvelope<TData> {
	version: typeof AI_VISIBILITY_RUN_API_VERSION;
	success: boolean;
	data: TData | null;
	error: RunError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<RunEnvelope<TData>>(
		{ version: AI_VISIBILITY_RUN_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: RunError) {
	return NextResponse.json<RunEnvelope<never>>(
		{ version: AI_VISIBILITY_RUN_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

export async function GET(
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
			.select()
			.from(aiVisibilityRuns)
			.where(eq(aiVisibilityRuns.id, runId))
			.get();

		if (!run) {
			return fail(404, { code: "NOT_FOUND", message: "Run not found" });
		}

		const accessContext = await getClientAccessContext(session, run.clientId);
		if (!can("aiVisibility", "view", { session, clientId: run.clientId, ...accessContext })) {
			return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
		}

		const summary = await getAiVisibilityRunSummary(runId);
		const results = await db
			.select()
			.from(aiVisibilityRunResults)
			.where(and(eq(aiVisibilityRunResults.runId, runId)))
			.orderBy(desc(aiVisibilityRunResults.createdAt))
			.limit(500)
			.all();

		return ok({ run, summary, results });
	} catch {
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to load run" });
	}
}
