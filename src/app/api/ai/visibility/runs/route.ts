import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibilityRuns } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";
import { aiVisibilityEnginesSchema } from "@/lib/ai/visibility-runner";

const AI_VISIBILITY_RUNS_API_VERSION = "1.0.0" as const;

type RunsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface RunsError {
	code: RunsErrorCode;
	message: string;
	details?: unknown;
}

interface RunsEnvelope<TData> {
	version: typeof AI_VISIBILITY_RUNS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: RunsError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<RunsEnvelope<TData>>(
		{ version: AI_VISIBILITY_RUNS_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: RunsError) {
	return NextResponse.json<RunsEnvelope<never>>(
		{ version: AI_VISIBILITY_RUNS_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

const createRunSchema = z.object({
	clientId: z.string().min(1),
	promptSetId: z.string().min(1),
	engines: aiVisibilityEnginesSchema.optional(),
	// If true, best-effort fire-and-forget execution is attempted.
	autoExecute: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
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

	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const clientId = searchParams.get("clientId");
	if (!clientId) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "clientId query param is required",
		});
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("aiVisibility", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const rows = await db
			.select()
			.from(aiVisibilityRuns)
			.where(and(eq(aiVisibilityRuns.clientId, clientId)))
			.orderBy(desc(aiVisibilityRuns.createdAt))
			.limit(50)
			.all();

		return ok(rows);
	} catch {
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to list runs" });
	}
}

export async function POST(request: NextRequest) {
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

	let parsed: z.infer<typeof createRunSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createRunSchema.safeParse(body);
		if (!validation.success) {
			return fail(400, {
				code: "VALIDATION_ERROR",
				message: "Invalid request payload",
				details: validation.error.flatten(),
			});
		}
		parsed = validation.data;
	} catch {
		return fail(400, { code: "VALIDATION_ERROR", message: "Request body must be valid JSON" });
	}

	const accessContext = await getClientAccessContext(session, parsed.clientId);
	if (!can("aiVisibility", "edit", { session, clientId: parsed.clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const engines = parsed.engines ?? ["CHATGPT", "PERPLEXITY", "GEMINI"];
		const [created] = await db
			.insert(aiVisibilityRuns)
			.values({
				clientId: parsed.clientId,
				promptSetId: parsed.promptSetId,
				engines: JSON.stringify(engines),
				status: "PENDING",
				triggeredBy: session.user.id,
				updatedAt: new Date(),
			})
			.returning();

		// Best-effort non-blocking execution.
		if (created?.id && parsed.autoExecute) {
			const { executeAiVisibilityRun } = await import("@/lib/ai/visibility-runner");
			void executeAiVisibilityRun(created.id);
		}

		return ok(created ?? null, 201);
	} catch {
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create run" });
	}
}
