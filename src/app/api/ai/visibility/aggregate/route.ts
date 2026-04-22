import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { phase2Flags } from "@/lib/flags";
import { getAiVisibilityAggregateSeries } from "@/lib/ai/visibility-aggregate";

const AI_VISIBILITY_AGGREGATE_API_VERSION = "1.0.0" as const;

type AggregateErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface AggregateError {
	code: AggregateErrorCode;
	message: string;
	details?: unknown;
}

interface AggregateEnvelope<TData> {
	version: typeof AI_VISIBILITY_AGGREGATE_API_VERSION;
	success: boolean;
	data: TData | null;
	error: AggregateError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<AggregateEnvelope<TData>>(
		{ version: AI_VISIBILITY_AGGREGATE_API_VERSION, success: true, data, error: null },
		{ status },
	);
}

function fail(status: number, error: AggregateError) {
	return NextResponse.json<AggregateEnvelope<never>>(
		{ version: AI_VISIBILITY_AGGREGATE_API_VERSION, success: false, data: null, error },
		{ status },
	);
}

const querySchema = z.object({
	clientId: z.string().min(1),
	window: z
		.enum(["30", "90"])
		.optional()
		.transform((v) => (v ? Number.parseInt(v, 10) : 30)),
});

export async function GET(request: NextRequest) {
	if (!phase2Flags.aiVisibilityV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"AI visibility aggregate APIs are disabled in this environment (FF_AI_VISIBILITY_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = querySchema.safeParse({
		clientId: searchParams.get("clientId"),
		window: searchParams.get("window") ?? undefined,
	});
	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query params",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, window } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("aiVisibility", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const series = await getAiVisibilityAggregateSeries({
			clientId,
			windowDays: window,
		});
		const latest = series.length > 0 ? series[series.length - 1] : null;
		return ok({ latest, series, windowDays: window });
	} catch {
		return fail(500, { code: "INTERNAL_ERROR", message: "Failed to load aggregates" });
	}
}
