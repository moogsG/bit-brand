import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibilityPrompts, aiVisibilityPromptSets } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";

const AI_VISIBILITY_PROMPT_SETS_API_VERSION = "1.0.0" as const;

type PromptErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "INTERNAL_ERROR";

interface PromptError {
	code: PromptErrorCode;
	message: string;
	details?: unknown;
}

interface PromptEnvelope<TData> {
	version: typeof AI_VISIBILITY_PROMPT_SETS_API_VERSION;
	success: boolean;
	data: TData | null;
	error: PromptError | null;
}

function buildSuccessResponse<TData>(data: TData) {
	return NextResponse.json<PromptEnvelope<TData>>({
		version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
		success: true,
		data,
		error: null,
	});
}

function buildErrorResponse(status: number, error: PromptError) {
	return NextResponse.json<PromptEnvelope<never>>(
		{
			version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const createPromptSchema = z.object({
	text: z.string().trim().min(1).max(4000),
	order: z.number().int().min(0).optional(),
	isActive: z.boolean().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

async function getPromptSetOrNull(promptSetId: string) {
	return db
		.select()
		.from(aiVisibilityPromptSets)
		.where(eq(aiVisibilityPromptSets.id, promptSetId))
		.get();
}

async function normalizePromptOrders(promptSetId: string, updatedBy?: string) {
	const rows = await db
		.select({
			id: aiVisibilityPrompts.id,
			order: aiVisibilityPrompts.order,
			createdAt: aiVisibilityPrompts.createdAt,
		})
		.from(aiVisibilityPrompts)
		.where(eq(aiVisibilityPrompts.promptSetId, promptSetId))
		.all();

	const sorted = [...rows].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	});

	for (let index = 0; index < sorted.length; index += 1) {
		const row = sorted[index];
		if (row.order === index) continue;
		await db
			.update(aiVisibilityPrompts)
			.set({
				order: index,
				updatedAt: new Date(),
				...(updatedBy ? { updatedBy } : {}),
			})
			.where(eq(aiVisibilityPrompts.id, row.id));
	}
}

async function movePromptToOrder(params: {
	promptSetId: string;
	promptId: string;
	targetOrder: number;
	updatedBy: string;
}) {
	const rows = await db
		.select({
			id: aiVisibilityPrompts.id,
			order: aiVisibilityPrompts.order,
			createdAt: aiVisibilityPrompts.createdAt,
		})
		.from(aiVisibilityPrompts)
		.where(eq(aiVisibilityPrompts.promptSetId, params.promptSetId))
		.all();

	const sorted = [...rows].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	});

	const currentIndex = sorted.findIndex((row) => row.id === params.promptId);
	if (currentIndex < 0) {
		return;
	}

	const moved = sorted[currentIndex];
	const remaining = sorted.filter((row) => row.id !== params.promptId);
	const clamped = Math.max(0, Math.min(params.targetOrder, remaining.length));
	const reordered = [...remaining.slice(0, clamped), moved, ...remaining.slice(clamped)];

	for (let index = 0; index < reordered.length; index += 1) {
		const row = reordered[index];
		if (row.order === index) continue;
		await db
			.update(aiVisibilityPrompts)
			.set({ order: index, updatedAt: new Date(), updatedBy: params.updatedBy })
			.where(eq(aiVisibilityPrompts.id, row.id));
	}
}

export async function GET(
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
	const promptSet = await getPromptSetOrNull(promptSetId);
	if (!promptSet) {
		return buildErrorResponse(404, { code: "NOT_FOUND", message: "Prompt set not found" });
	}

	const accessContext = await getClientAccessContext(session, promptSet.clientId);
	if (!can("aiVisibility", "view", { session, clientId: promptSet.clientId, ...accessContext })) {
		return buildErrorResponse(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	const rows = await db
		.select()
		.from(aiVisibilityPrompts)
		.where(eq(aiVisibilityPrompts.promptSetId, promptSetId))
		.all();

	const sorted = [...rows].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	});

	return buildSuccessResponse(sorted);
}

export async function POST(
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
	const promptSet = await getPromptSetOrNull(promptSetId);
	if (!promptSet) {
		return buildErrorResponse(404, { code: "NOT_FOUND", message: "Prompt set not found" });
	}

	const accessContext = await getClientAccessContext(session, promptSet.clientId);
	if (!can("aiVisibility", "edit", { session, clientId: promptSet.clientId, ...accessContext })) {
		return buildErrorResponse(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	let parsed: z.infer<typeof createPromptSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createPromptSchema.safeParse(body);
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
		const existing = await db
			.select({ order: aiVisibilityPrompts.order })
			.from(aiVisibilityPrompts)
			.where(eq(aiVisibilityPrompts.promptSetId, promptSetId))
			.all();

		const maxOrder = existing.reduce((acc, row) => Math.max(acc, row.order), -1);
		const initialOrder = parsed.order ?? maxOrder + 1;

		const [created] = await db
			.insert(aiVisibilityPrompts)
			.values({
				promptSetId,
				text: parsed.text,
				order: initialOrder,
				isActive: parsed.isActive ?? true,
				metadata: JSON.stringify(parsed.metadata ?? {}),
				createdBy: session.user.id,
				updatedBy: session.user.id,
				updatedAt: new Date(),
			})
			.returning();

		// Normalize first (guards against sparse / duplicate orders).
		await normalizePromptOrders(promptSetId, session.user.id);
		// If an explicit order was requested, treat it as an insertion index.
		if (created?.id && parsed.order !== undefined) {
			await movePromptToOrder({
				promptSetId,
				promptId: created.id,
				targetOrder: parsed.order,
				updatedBy: session.user.id,
			});
			await normalizePromptOrders(promptSetId, session.user.id);
		}

		return NextResponse.json(
			{
				version: AI_VISIBILITY_PROMPT_SETS_API_VERSION,
				success: true,
				data: created ?? null,
				error: null,
			} satisfies PromptEnvelope<typeof created>,
			{ status: 201 },
		);
	} catch {
		return buildErrorResponse(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create prompt",
		});
	}
}
