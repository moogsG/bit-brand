import { and, desc, eq, type SQL } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { eeatQuestionnaires } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

const EEAT_QUESTIONNAIRES_API_VERSION = "1.0.0" as const;

type EeatQuestionnairesErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface EeatQuestionnairesError {
	code: EeatQuestionnairesErrorCode;
	message: string;
	details?: unknown;
}

interface EeatQuestionnairesEnvelope<TData> {
	version: typeof EEAT_QUESTIONNAIRES_API_VERSION;
	success: boolean;
	data: TData | null;
	error: EeatQuestionnairesError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<EeatQuestionnairesEnvelope<TData>>(
		{
			version: EEAT_QUESTIONNAIRES_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: EeatQuestionnairesError) {
	return NextResponse.json<EeatQuestionnairesEnvelope<never>>(
		{
			version: EEAT_QUESTIONNAIRES_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

function normalizeContentType(value: string): string {
	return value.trim().toUpperCase();
}

const questionnaireDefinitionSchema = z
	.object({
		sections: z.array(z.unknown()).optional(),
		questions: z.array(z.unknown()).optional(),
	})
	.passthrough()
	.superRefine((value, ctx) => {
		if (!Array.isArray(value.sections) && !Array.isArray(value.questions)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"schema must include at least one array property: sections or questions",
			});
		}
	});

const getQuerySchema = z.object({
	clientId: z.string().min(1),
	contentType: z
		.string()
		.min(1)
		.transform((value) => normalizeContentType(value))
		.refine((value) => value.length > 0, {
			message: "contentType must not be empty",
		})
		.optional(),
});

const createQuestionnaireSchema = z.object({
	clientId: z.string().min(1),
	contentType: z
		.string()
		.min(1)
		.transform((value) => normalizeContentType(value))
		.refine((value) => value.length > 0, {
			message: "contentType is required",
		}),
	schema: questionnaireDefinitionSchema,
	version: z.number().int().min(1).optional(),
	isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
	if (!phase3Flags.eeatQuestionnairesV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"EEAT questionnaire APIs are disabled in this environment (FF_EEAT_QUESTIONNAIRES_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const searchParams =
		request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = getQuerySchema.safeParse({
		clientId: searchParams.get("clientId") ?? undefined,
		contentType: searchParams.get("contentType") ?? undefined,
	});

	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, contentType } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("content", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const conditions: SQL[] = [eq(eeatQuestionnaires.clientId, clientId)];
		if (contentType) {
			conditions.push(eq(eeatQuestionnaires.contentType, contentType));
		}

		const rows = await db
			.select()
			.from(eeatQuestionnaires)
			.where(and(...conditions))
			.orderBy(desc(eeatQuestionnaires.version))
			.all();

		return ok(rows);
	} catch (error) {
		console.error("[eeat.questionnaires] list failed", {
			clientId,
			contentType,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list EEAT questionnaires",
		});
	}
}

export async function POST(request: NextRequest) {
	if (!phase3Flags.eeatQuestionnairesV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"EEAT questionnaire APIs are disabled in this environment (FF_EEAT_QUESTIONNAIRES_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	let parsed: z.infer<typeof createQuestionnaireSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createQuestionnaireSchema.safeParse(body);
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
		!can("content", "edit", {
			session,
			clientId: parsed.clientId,
			...accessContext,
		})
	) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const existingRows = await db
			.select({ version: eeatQuestionnaires.version })
			.from(eeatQuestionnaires)
			.where(
				and(
					eq(eeatQuestionnaires.clientId, parsed.clientId),
					eq(eeatQuestionnaires.contentType, parsed.contentType),
				),
			)
			.orderBy(desc(eeatQuestionnaires.version))
			.all();

		const nextVersion =
			typeof parsed.version === "number"
				? parsed.version
				: (existingRows[0]?.version ?? 0) + 1;

		const nextIsActive = parsed.isActive ?? true;
		if (nextIsActive) {
			await db
				.update(eeatQuestionnaires)
				.set({ isActive: false, updatedAt: new Date() })
				.where(
					and(
						eq(eeatQuestionnaires.clientId, parsed.clientId),
						eq(eeatQuestionnaires.contentType, parsed.contentType),
						eq(eeatQuestionnaires.isActive, true),
					),
				)
				.returning();
		}

		const now = new Date();
		const [created] = await db
			.insert(eeatQuestionnaires)
			.values({
				clientId: parsed.clientId,
				contentType: parsed.contentType,
				schema: JSON.stringify(parsed.schema),
				version: nextVersion,
				isActive: nextIsActive,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return ok(created ?? null, 201);
	} catch (error) {
		console.error("[eeat.questionnaires] create failed", {
			clientId: parsed.clientId,
			contentType: parsed.contentType,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create EEAT questionnaire",
		});
	}
}
