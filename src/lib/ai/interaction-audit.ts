import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { aiInteractions } from "@/lib/db/schema";

export type AiInteractionRouteKey = "ai.lens.recommend";

export interface AiInteractionAuditParams {
	enabled: boolean;
	routeKey: AiInteractionRouteKey;
	requestId: string;
	clientId: string | null;
	userId: string | null;
	module?: string;
	lensKey?: string;
	scope?: "agency-full" | "client-safe";
	httpStatus: number;
	success: boolean;
	durationMs: number;
	input: {
		question?: string;
		questionLength?: number;
	};
	output: {
		recommendationType?: string;
		signalsCount?: number;
		suggestedActionsCount?: number;
	};
	errorCode?: string;
}

function sha256Hex(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

export async function recordAiInteractionAudit(params: AiInteractionAuditParams) {
	if (!params.enabled) return;

	const questionHash = params.input.question ? sha256Hex(params.input.question) : null;
	const inputShapeHash = sha256Hex(
		JSON.stringify({
			routeKey: params.routeKey,
			module: params.module ?? null,
			lensKey: params.lensKey ?? null,
			questionHash,
			questionLength: params.input.questionLength ?? null,
		}),
	);
	const outputShapeHash = sha256Hex(
		JSON.stringify({
			recommendationType: params.output.recommendationType ?? null,
			signalsCount: params.output.signalsCount ?? null,
			suggestedActionsCount: params.output.suggestedActionsCount ?? null,
		}),
	);

	try {
		await db.insert(aiInteractions).values({
			requestId: params.requestId,
			routeKey: params.routeKey,
			clientId: params.clientId,
			userId: params.userId,
			module: params.module ?? null,
			lensKey: params.lensKey ?? null,
			scope: params.scope ?? null,
			httpStatus: params.httpStatus,
			success: params.success,
			durationMs: params.durationMs,
			inputShapeHash,
			outputShapeHash,
			errorCode: params.errorCode ?? null,
			meta: JSON.stringify({
				questionLength: params.input.questionLength ?? null,
				signalsCount: params.output.signalsCount ?? null,
				suggestedActionsCount: params.output.suggestedActionsCount ?? null,
			}),
		});
	} catch (error) {
		// This is best-effort observability; never fail the request.
		console.warn("[ai.interactions.audit] failed", {
			routeKey: params.routeKey,
			requestId: params.requestId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
