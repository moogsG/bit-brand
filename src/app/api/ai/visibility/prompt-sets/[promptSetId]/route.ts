import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibilityPromptSets } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";

const AI_VISIBILITY_PROMPT_SETS_API_VERSION = "1.0.0" as const;

type PromptSetErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface PromptSetError {
	code: PromptSetErrorCode;
	message: string;
	details?: unknown;
}

interface PromptSetEnvelope<TData> {
	version: typeof AI_VISIBILITY_PROMPT_SETS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: PromptSetError | null;
}

function buildSuccessResponse<TData>(data: TData) {
	return NextResponse.json<PromptSetEnvelope<TData>>({
		version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
		success: true,
		data,
		error: null,
	});
}

function buildErrorResponse(status: number, error: PromptSetError) {
	return NextResponse.json<PromptSetEnvelope<never>>(
		{
			version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const updatePromptSetSchema = z
	.object({
		name: z.string().trim().min(1).max(160).optional(),
		isActive: z.boolean().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one field must be provided",
	});

async function getPromptSetOrNull(promptSetId: string) {
	return db
		.select()
		.from(aiVisibilityPromptSets)
		.where(eq(aiVisibilityPromptSets.id, promptSetId))
		.get();
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ promptSetId: string }> },
) {
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

	const { promptSetId } = await params;
	const existing = await getPromptSetOrNull(promptSetId);
	if (!existing) {
		return buildErrorResponse(404, { code: "NOT_FOUND", message: "Prompt set not found" });
	}

	const accessContext = await getClientAccessContext(session, existing.clientId);
	if (!can("aiVisibility", "edit", { session, clientId: existing.clientId, ...accessContext })) {
		return buildErrorResponse(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	let parsed: z.infer<typeof updatePromptSetSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = updatePromptSetSchema.safeParse(body);
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

	try {
		const [updated] = await db
			.update(aiVisibilityPromptSets)
			.set({
				...(parsed.name !== undefined ? { name: parsed.name } : {}),
				...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
				...(parsed.metadata !== undefined
					? { metadata: JSON.stringify(parsed.metadata) }
					: {}),
				updatedBy: session.user.id,
				updatedAt: new Date(),
			})
			.where(eq(aiVisibilityPromptSets.id, promptSetId))
			.returning();

		if (!updated) {
			return buildErrorResponse(404, { code: "NOT_FOUND", message: "Prompt set not found" });
		}

		return buildSuccessResponse(updated);
	} catch {
		return buildErrorResponse(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to update prompt set",
		});
	}
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ promptSetId: string }> },
) {
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

	const { promptSetId } = await params;
	const existing = await getPromptSetOrNull(promptSetId);
	if (!existing) {
		return buildErrorResponse(404, { code: "NOT_FOUND", message: "Prompt set not found" });
	}

	const accessContext = await getClientAccessContext(session, existing.clientId);
	if (!can("aiVisibility", "edit", { session, clientId: existing.clientId, ...accessContext })) {
		return buildErrorResponse(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const [deleted] = await db
			.delete(aiVisibilityPromptSets)
			.where(eq(aiVisibilityPromptSets.id, promptSetId))
			.returning();

		if (!deleted) {
			return buildErrorResponse(404, { code: "NOT_FOUND", message: "Prompt set not found" });
		}

		return buildSuccessResponse({ success: true });
	} catch {
		return buildErrorResponse(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to delete prompt set",
		});
	}
}
