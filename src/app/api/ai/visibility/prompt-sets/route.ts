import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibilityPromptSets } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";

const AI_VISIBILITY_PROMPT_SETS_API_VERSION = "1.0.0" as const;

type PromptSetsErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface PromptSetsError {
	code: PromptSetsErrorCode;
	message: string;
	details?: unknown;
}

interface PromptSetsEnvelope<TData> {
	version: typeof AI_VISIBILITY_PROMPT_SETS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: PromptSetsError | null;
}

function buildSuccessResponse<TData>(data: TData) {
	return NextResponse.json<PromptSetsEnvelope<TData>>({
		version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
		success: true,
		data,
		error: null,
	});
}

function buildErrorResponse(status: number, error: PromptSetsError) {
	return NextResponse.json<PromptSetsEnvelope<never>>(
		{
			version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const createPromptSetSchema = z.object({
	clientId: z.string().min(1),
	name: z.string().trim().min(1).max(160),
	isActive: z.boolean().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
	if (!phase2Flags.aiVisibilityV1()) {
		return buildErrorResponse(404, {
			code: "MODULE_DISABLED",
			message:
				"AI visibility prompt set APIs are disabled in this environment (FF_AI_VISIBILITY_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return buildErrorResponse(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const clientId = searchParams.get("clientId");
	if (!clientId) {
		return buildErrorResponse(400, {
			code: "VALIDATION_ERROR",
			message: "clientId query param is required",
		});
	}

	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("aiVisibility", "view", { session, clientId, ...accessContext })) {
		return buildErrorResponse(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const rows = await db
		.select()
		.from(aiVisibilityPromptSets)
		.where(and(eq(aiVisibilityPromptSets.clientId, clientId)))
		.all();

	// Stable ordering for UI rendering.
	const sorted = [...rows].sort((a, b) => {
		if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
		const aUpdated = new Date(a.updatedAt).getTime();
		const bUpdated = new Date(b.updatedAt).getTime();
		return bUpdated - aUpdated;
	});

	return buildSuccessResponse(sorted);
}

export async function POST(request: NextRequest) {
	if (!phase2Flags.aiVisibilityV1()) {
		return buildErrorResponse(404, {
			code: "MODULE_DISABLED",
			message:
				"AI visibility prompt set APIs are disabled in this environment (FF_AI_VISIBILITY_V1=false)",
		});
	}

	const session = await auth();
	if (!session) {
		return buildErrorResponse(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
	}

	let parsed: z.infer<typeof createPromptSetSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createPromptSetSchema.safeParse(body);
		if (!validation.success) {
			return buildErrorResponse(400, {
				code: "VALIDATION_ERROR",
				message: "Invalid request payload",
				details: validation.error.flatten(),
			});
		}
		parsed = validation.data;
	} catch {
		return buildErrorResponse(400, {
			code: "VALIDATION_ERROR",
			message: "Request body must be valid JSON",
		});
	}

	const accessContext = await getClientAccessContext(session, parsed.clientId);
	if (!can("aiVisibility", "edit", { session, clientId: parsed.clientId, ...accessContext })) {
		return buildErrorResponse(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const [created] = await db
			.insert(aiVisibilityPromptSets)
			.values({
				clientId: parsed.clientId,
				name: parsed.name,
				isActive: parsed.isActive ?? true,
				metadata: JSON.stringify(parsed.metadata ?? {}),
				createdBy: session.user.id,
				updatedBy: session.user.id,
				updatedAt: new Date(),
			})
			.returning();

		return NextResponse.json(
			{
				version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
				success: true,
				data: created ?? null,
				error: null,
			} satisfies PromptSetsEnvelope<typeof created>,
			{ status: 201 },
		);
	} catch {
		return buildErrorResponse(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create prompt set",
		});
	}
}
