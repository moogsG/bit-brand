import { and, desc, eq, type SQL } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can, resolvePermissionRole } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { isClientEquivalentRole } from "@/lib/auth/role-mapping";
import { db } from "@/lib/db";
import {
	contentBriefs,
	eeatQuestionnaires,
	eeatResponses,
} from "@/lib/db/schema";
import { createEeatScoreSnapshotForResponse } from "@/lib/eeat/service";
import { phase2Flags, phase3Flags } from "@/lib/flags";

const EEAT_RESPONSES_API_VERSION = "1.0.0" as const;

type EeatResponsesErrorCode =
	| "MODULE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "INTERNAL_ERROR";

interface EeatResponsesError {
	code: EeatResponsesErrorCode;
	message: string;
	details?: unknown;
}

interface EeatResponsesEnvelope<TData> {
	version: typeof EEAT_RESPONSES_API_VERSION;
	success: boolean;
	data: TData | null;
	error: EeatResponsesError | null;
}

function ok<TData>(data: TData, status = 200) {
	return NextResponse.json<EeatResponsesEnvelope<TData>>(
		{
			version: EEAT_RESPONSES_API_VERSION,
			success: true,
			data,
			error: null,
		},
		{ status },
	);
}

function fail(status: number, error: EeatResponsesError) {
	return NextResponse.json<EeatResponsesEnvelope<never>>(
		{
			version: EEAT_RESPONSES_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

const getQuerySchema = z.object({
	clientId: z.string().min(1),
	questionnaireId: z.string().min(1).optional(),
	briefId: z.string().min(1).optional(),
});

const responsesObjectSchema = z
	.record(z.string(), z.unknown())
	.refine((value) => Object.keys(value).length > 0, {
		message: "responses must be a non-empty JSON object",
	});

const createResponseSchema = z.object({
	clientId: z.string().min(1),
	questionnaireId: z.string().min(1),
	briefId: z.string().min(1).optional(),
	responses: responsesObjectSchema,
});

function hasPostAccess(
	requestClientId: string,
	session: {
		user?: {
			id?: string;
			role?: string;
			rawRole?: string;
			clientId?: string;
		};
	},
	accessContext: Awaited<ReturnType<typeof getClientAccessContext>>,
): boolean {
	if (
		can("content", "edit", {
			session,
			clientId: requestClientId,
			...accessContext,
		})
	) {
		return true;
	}

	const role = resolvePermissionRole({ session });
	if (!isClientEquivalentRole(role)) {
		return false;
	}

	return can("content", "view", {
		session,
		clientId: requestClientId,
		...accessContext,
	});
}

export async function GET(request: NextRequest) {
	if (!phase3Flags.eeatQuestionnairesV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"EEAT response APIs are disabled in this environment (FF_EEAT_QUESTIONNAIRES_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	const searchParams =
		request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const parsed = getQuerySchema.safeParse({
		clientId: searchParams.get("clientId") ?? undefined,
		questionnaireId: searchParams.get("questionnaireId") ?? undefined,
		briefId: searchParams.get("briefId") ?? undefined,
	});

	if (!parsed.success) {
		return fail(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid query parameters",
			details: parsed.error.flatten(),
		});
	}

	const { clientId, questionnaireId, briefId } = parsed.data;
	const accessContext = await getClientAccessContext(session, clientId);
	if (!can("content", "view", { session, clientId, ...accessContext })) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const conditions: SQL[] = [eq(eeatResponses.clientId, clientId)];
		if (questionnaireId) {
			conditions.push(eq(eeatResponses.questionnaireId, questionnaireId));
		}
		if (briefId) {
			conditions.push(eq(eeatResponses.briefId, briefId));
		}

		const rows = await db
			.select()
			.from(eeatResponses)
			.where(and(...conditions))
			.orderBy(desc(eeatResponses.updatedAt))
			.all();

		return ok(rows);
	} catch (error) {
		console.error("[eeat.responses] list failed", {
			clientId,
			questionnaireId,
			briefId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to list EEAT responses",
		});
	}
}

export async function POST(request: NextRequest) {
	if (!phase3Flags.eeatQuestionnairesV1()) {
		return fail(404, {
			code: "MODULE_DISABLED",
			message:
				"EEAT response APIs are disabled in this environment (FF_EEAT_QUESTIONNAIRES_V1=false)",
		});
	}

	const session = await auth();
	if (!session)
		return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });

	let parsed: z.infer<typeof createResponseSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = createResponseSchema.safeParse(body);
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
	if (!hasPostAccess(parsed.clientId, session, accessContext)) {
		return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
	}

	try {
		const questionnaire = await db
			.select({
				id: eeatQuestionnaires.id,
				clientId: eeatQuestionnaires.clientId,
			})
			.from(eeatQuestionnaires)
			.where(eq(eeatQuestionnaires.id, parsed.questionnaireId))
			.get();

		if (!questionnaire) {
			return fail(404, {
				code: "NOT_FOUND",
				message: "Questionnaire not found",
			});
		}

		if (questionnaire.clientId !== parsed.clientId) {
			return fail(400, {
				code: "VALIDATION_ERROR",
				message: "questionnaireId does not belong to clientId",
			});
		}

		if (parsed.briefId) {
			const brief = await db
				.select({ id: contentBriefs.id, clientId: contentBriefs.clientId })
				.from(contentBriefs)
				.where(eq(contentBriefs.id, parsed.briefId))
				.get();

			if (!brief) {
				return fail(404, {
					code: "NOT_FOUND",
					message: "Brief not found",
				});
			}

			if (brief.clientId !== parsed.clientId) {
				return fail(400, {
					code: "VALIDATION_ERROR",
					message: "briefId does not belong to clientId",
				});
			}
		}

		const now = new Date();
		const [created] = await db
			.insert(eeatResponses)
			.values({
				clientId: parsed.clientId,
				questionnaireId: parsed.questionnaireId,
				briefId: parsed.briefId ?? null,
				respondentUserId: session.user.id ?? null,
				responses: JSON.stringify(parsed.responses),
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		if (created && phase2Flags.eeatScoringV1()) {
			try {
				await createEeatScoreSnapshotForResponse(created.id);
			} catch (scoreError) {
				console.error("[eeat.responses] score snapshot failed", {
					responseId: created.id,
					clientId: created.clientId,
					questionnaireId: created.questionnaireId,
					error:
						scoreError instanceof Error
							? scoreError.message
							: String(scoreError),
				});
			}
		}

		return ok(created ?? null, 201);
	} catch (error) {
		console.error("[eeat.responses] create failed", {
			clientId: parsed.clientId,
			questionnaireId: parsed.questionnaireId,
			briefId: parsed.briefId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fail(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to create EEAT response",
		});
	}
}
