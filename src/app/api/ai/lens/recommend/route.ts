import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildClientContextPayload } from "@/lib/ai/context-builder";
import { recordAiInteractionAudit } from "@/lib/ai/interaction-audit";
import { getLensConfig, resolveLensKeyFromModule } from "@/lib/ai/lens-config";
import {
	buildLensRecommendation,
	buildLensRecommendationV2,
	type LensModule,
	lensModuleSchema,
	lensRecommendationSchema,
} from "@/lib/ai/lens-recommendation";
import { auth } from "@/lib/auth";
import {
	type AuthorizationContext,
	can,
	resolvePermissionRole,
} from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { isClientEquivalentRole } from "@/lib/auth/role-mapping";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase1Flags, phase2Flags } from "@/lib/flags";
import { buildPromptResearchRecommendations } from "@/lib/prompt-research/recommendations";

const AI_LENS_RECOMMEND_API_VERSION = "1.0.0" as const;

const requestSchema = z.object({
	module: lensModuleSchema,
	clientId: z.string().min(1),
	question: z.string().trim().min(3).max(2000),
});

const recommendationResponseSchema = z.object({
	clientId: z.string(),
	module: lensModuleSchema,
	lens: z.object({
		key: z.string(),
		displayName: z.string(),
	}),
	scope: z.enum(["agency-full", "client-safe"]),
	contextVersion: z.string(),
	recommendation: lensRecommendationSchema,
});

type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;

type LensRecommendErrorCode =
	| "FEATURE_DISABLED"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "VALIDATION_ERROR"
	| "MODULE_DISABLED"
	| "CLIENT_NOT_FOUND"
	| "INTERNAL_ERROR";

interface LensRecommendError {
	code: LensRecommendErrorCode;
	message: string;
	details?: unknown;
}

interface LensRecommendEnvelope<TData> {
	version: typeof AI_LENS_RECOMMEND_API_VERSION;
	success: boolean;
	data: TData | null;
	error: LensRecommendError | null;
}

function buildSuccessResponse(data: RecommendationResponse) {
	return NextResponse.json<LensRecommendEnvelope<RecommendationResponse>>({
		version: AI_LENS_RECOMMEND_API_VERSION,
		success: true,
		data,
		error: null,
	});
}

function buildErrorResponse(status: number, error: LensRecommendError) {
	return NextResponse.json<LensRecommendEnvelope<RecommendationResponse>>(
		{
			version: AI_LENS_RECOMMEND_API_VERSION,
			success: false,
			data: null,
			error,
		},
		{ status },
	);
}

function mapLensModuleToPermissionModule(module: LensModule) {
	const moduleMap: Record<LensModule, Parameters<typeof can>[0]> = {
		dashboard: "reports",
		"goal-planning": "onboarding",
		onboarding: "onboarding",
		keywords: "keywords",
		"prompt-research": "promptResearch",
		technical: "technical",
		strategy: "strategies",
		reports: "reports",
		reporting: "reports",
		"ai-visibility": "aiVisibility",
	};

	return moduleMap[module];
}

function toClientSafeSubset(
	context: Awaited<ReturnType<typeof buildClientContextPayload>>,
) {
	return {
		...context,
		opportunities: {
			placeholder: context.opportunities.placeholder,
			items: [],
		},
		risks: {
			placeholder: context.risks.placeholder,
			items: [],
		},
	};
}

async function getClientOrNull(clientId: string) {
	return db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.isActive, true)))
		.get();
}

function logSafeTelemetry(params: {
	requestId: string;
	module: LensModule;
	clientId: string;
	question: string;
	role: string;
	scope: "agency-full" | "client-safe";
	recommendationId: string;
	accessContext: Pick<
		AuthorizationContext,
		"assignedClientIds" | "isClientMember"
	>;
}) {
	console.info("[ai.lens.recommend.placeholder]", {
		requestId: params.requestId,
		module: params.module,
		clientId: params.clientId,
		role: params.role,
		scope: params.scope,
		questionLength: params.question.length,
		hasQuestionMark: params.question.includes("?"),
		recommendationId: params.recommendationId,
		isClientMember: Boolean(params.accessContext.isClientMember),
		assignedClientCount: params.accessContext.assignedClientIds?.length ?? 0,
	});
}

export async function POST(request: NextRequest) {
	const requestId = crypto.randomUUID();
	const startedAtMs = Date.now();
	const auditEnabled = phase2Flags.aiInteractionsV1();

	if (!phase1Flags.aiContextV1()) {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: null,
			userId: null,
			httpStatus: 404,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: {},
			output: {},
			errorCode: "FEATURE_DISABLED",
		});
		return buildErrorResponse(404, {
			code: "FEATURE_DISABLED",
			message: "AI context endpoints are disabled in this environment",
		});
	}

	const session = await auth();
	if (!session) {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: null,
			userId: null,
			httpStatus: 401,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: {},
			output: {},
			errorCode: "UNAUTHORIZED",
		});
		return buildErrorResponse(401, {
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	}

	let parsedRequest: z.infer<typeof requestSchema>;
	try {
		const body = (await request.json()) as unknown;
		const validation = requestSchema.safeParse(body);
		if (!validation.success) {
			await recordAiInteractionAudit({
				enabled: auditEnabled,
				routeKey: "ai.lens.recommend",
				requestId,
				clientId: null,
				userId: session.user?.id ?? null,
				httpStatus: 400,
				success: false,
				durationMs: Date.now() - startedAtMs,
				input: {},
				output: {},
				errorCode: "VALIDATION_ERROR",
			});
			return buildErrorResponse(400, {
				code: "VALIDATION_ERROR",
				message: "Invalid request payload",
				details: validation.error.flatten(),
			});
		}

		parsedRequest = validation.data;
	} catch {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: null,
			userId: session.user?.id ?? null,
			httpStatus: 400,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: {},
			output: {},
			errorCode: "VALIDATION_ERROR",
		});
		return buildErrorResponse(400, {
			code: "VALIDATION_ERROR",
			message: "Request body must be valid JSON",
		});
	}

	const accessContext = await getClientAccessContext(
		session,
		parsedRequest.clientId,
	);
	const permissionModule = mapLensModuleToPermissionModule(
		parsedRequest.module,
	);

	if (
		parsedRequest.module === "ai-visibility" &&
		!phase2Flags.aiVisibilityV1()
	) {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: parsedRequest.clientId,
			userId: session.user?.id ?? null,
			module: parsedRequest.module,
			lensKey: resolveLensKeyFromModule(parsedRequest.module),
			httpStatus: 404,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: {
				question: parsedRequest.question,
				questionLength: parsedRequest.question.length,
			},
			output: {},
			errorCode: "MODULE_DISABLED",
		});
		return buildErrorResponse(404, {
			code: "MODULE_DISABLED",
			message:
				"AI visibility lens recommendations are disabled in this environment",
		});
	}

	if (
		parsedRequest.module === "prompt-research" &&
		!phase2Flags.promptResearchV1()
	) {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: parsedRequest.clientId,
			userId: session.user?.id ?? null,
			module: parsedRequest.module,
			lensKey: resolveLensKeyFromModule(parsedRequest.module),
			httpStatus: 404,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: {
				question: parsedRequest.question,
				questionLength: parsedRequest.question.length,
			},
			output: {},
			errorCode: "MODULE_DISABLED",
		});
		return buildErrorResponse(404, {
			code: "MODULE_DISABLED",
			message:
				"Prompt research lens recommendations are disabled in this environment",
		});
	}

	if (
		!can(permissionModule, "view", {
			session,
			clientId: parsedRequest.clientId,
			...accessContext,
		})
	) {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: parsedRequest.clientId,
			userId: session.user?.id ?? null,
			module: parsedRequest.module,
			lensKey: resolveLensKeyFromModule(parsedRequest.module),
			httpStatus: 403,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: {
				question: parsedRequest.question,
				questionLength: parsedRequest.question.length,
			},
			output: {},
			errorCode: "FORBIDDEN",
		});
		return buildErrorResponse(403, {
			code: "FORBIDDEN",
			message: "Forbidden",
		});
	}

	const role = resolvePermissionRole({ session });

	const client = await getClientOrNull(parsedRequest.clientId);
	if (!client) {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: parsedRequest.clientId,
			userId: session.user?.id ?? null,
			module: parsedRequest.module,
			lensKey: resolveLensKeyFromModule(parsedRequest.module),
			httpStatus: 404,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: {
				question: parsedRequest.question,
				questionLength: parsedRequest.question.length,
			},
			output: {},
			errorCode: "CLIENT_NOT_FOUND",
		});
		return buildErrorResponse(404, {
			code: "CLIENT_NOT_FOUND",
			message: "Client not found",
		});
	}

	try {
		const context = await buildClientContextPayload(parsedRequest.clientId);
		const scope = isClientEquivalentRole(role) ? "client-safe" : "agency-full";
		const scopedContext =
			scope === "client-safe" ? toClientSafeSubset(context) : context;
		const lensKey = resolveLensKeyFromModule(parsedRequest.module);
		const lensCfg = getLensConfig(lensKey);
		let detailsOverrides: Record<string, unknown> | undefined;

		if (
			phase2Flags.lensRouterV2() &&
			parsedRequest.module === "prompt-research"
		) {
			try {
				const promptResearch = await buildPromptResearchRecommendations({
					clientId: parsedRequest.clientId,
					windowDays: 90,
					limit: 3,
				});

				detailsOverrides = {
					recommendationSource: "prompt-research-service-v1",
					promptResearch: {
						windowDays: promptResearch.windowDays,
						startDate: promptResearch.startDate,
						promptSet: promptResearch.promptSet,
						totals: promptResearch.totals,
						recommendations: promptResearch.recommendations.map((item) => ({
							id: item.id,
							title: item.title,
							priority: item.priority,
							rationale: item.rationale,
							action: item.action,
						})),
					},
				};
			} catch {
				detailsOverrides = undefined;
			}
		}

		const recommendation = phase2Flags.lensRouterV2()
			? buildLensRecommendationV2({
					module: parsedRequest.module,
					question: parsedRequest.question,
					context: scopedContext,
					lensMeta: { key: lensCfg.key, displayName: lensCfg.displayName },
					detailsOverrides,
				})
			: buildLensRecommendation({
					module: parsedRequest.module,
					question: parsedRequest.question,
					context: scopedContext,
					lensMeta: { key: lensCfg.key, displayName: lensCfg.displayName },
				});

		const responseData = recommendationResponseSchema.parse({
			clientId: parsedRequest.clientId,
			module: parsedRequest.module,
			lens: { key: lensCfg.key, displayName: lensCfg.displayName },
			scope,
			contextVersion: scopedContext.version,
			recommendation,
		});

		logSafeTelemetry({
			requestId,
			module: parsedRequest.module,
			clientId: parsedRequest.clientId,
			question: parsedRequest.question,
			role,
			scope,
			recommendationId: recommendation.id,
			accessContext,
		});

		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: parsedRequest.clientId,
			userId: session.user?.id ?? null,
			module: parsedRequest.module,
			lensKey,
			scope,
			httpStatus: 200,
			success: true,
			durationMs: Date.now() - startedAtMs,
			input: {
				question: parsedRequest.question,
				questionLength: parsedRequest.question.length,
			},
			output: {
				recommendationType: recommendation.type,
				signalsCount: recommendation.signals.length,
				suggestedActionsCount: recommendation.suggestedActions.length,
			},
		});

		return buildSuccessResponse(responseData);
	} catch {
		await recordAiInteractionAudit({
			enabled: auditEnabled,
			routeKey: "ai.lens.recommend",
			requestId,
			clientId: parsedRequest?.clientId ?? null,
			userId: session.user?.id ?? null,
			module: parsedRequest?.module,
			lensKey: parsedRequest
				? resolveLensKeyFromModule(parsedRequest.module)
				: undefined,
			httpStatus: 500,
			success: false,
			durationMs: Date.now() - startedAtMs,
			input: parsedRequest
				? {
						question: parsedRequest.question,
						questionLength: parsedRequest.question.length,
					}
				: {},
			output: {},
			errorCode: "INTERNAL_ERROR",
		});
		return buildErrorResponse(500, {
			code: "INTERNAL_ERROR",
			message: "Failed to generate recommendation",
		});
	}
}
