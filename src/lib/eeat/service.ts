import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	type EeatScore,
	eeatQuestionnaires,
	eeatResponses,
	eeatScores,
} from "@/lib/db/schema";
import {
	computeEeatScore,
	type EeatRecommendation,
	type EeatScoreComputation,
	type EeatScoreFactor,
	parseEeatRecommendationsJson,
} from "./scoring";

export interface EeatScoreSnapshotResult {
	row: EeatScore;
	computed: EeatScoreComputation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonRecord(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw) as unknown;
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

export function parseFactorBreakdown(raw: string): EeatScoreFactor[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.flatMap((item) => {
			if (!isRecord(item)) {
				return [];
			}

			const key = typeof item.key === "string" ? item.key : "weightedAlignment";
			const label =
				typeof item.label === "string" && item.label.trim().length > 0
					? item.label
					: "Factor";
			const score =
				typeof item.score === "number" && Number.isFinite(item.score)
					? item.score
					: 0;
			const weight =
				typeof item.weight === "number" && Number.isFinite(item.weight)
					? item.weight
					: 0;

			if (
				key !== "coverage" &&
				key !== "requiredCompleteness" &&
				key !== "responseQuality" &&
				key !== "weightedAlignment"
			) {
				return [];
			}

			return [
				{
					key,
					label,
					score,
					weight,
				} satisfies EeatScoreFactor,
			];
		});
	} catch {
		return [];
	}
}

export function parseRecommendations(raw: string): EeatRecommendation[] {
	return parseEeatRecommendationsJson(raw);
}

export async function createEeatScoreSnapshotForResponse(
	responseId: string,
): Promise<EeatScoreSnapshotResult | null> {
	const response = await db
		.select()
		.from(eeatResponses)
		.where(eq(eeatResponses.id, responseId))
		.get();

	if (!response) {
		return null;
	}

	const questionnaire = await db
		.select()
		.from(eeatQuestionnaires)
		.where(eq(eeatQuestionnaires.id, response.questionnaireId))
		.get();

	if (!questionnaire || questionnaire.clientId !== response.clientId) {
		return null;
	}

	const computed = computeEeatScore({
		questionnaireSchema: parseJsonRecord(questionnaire.schema),
		responsePayload: parseJsonRecord(response.responses),
	});

	const now = new Date();
	const [row] = await db
		.insert(eeatScores)
		.values({
			clientId: response.clientId,
			questionnaireId: response.questionnaireId,
			responseId: response.id,
			briefId: response.briefId ?? null,
			overallScore: computed.overallScore,
			factorBreakdown: JSON.stringify(computed.factorBreakdown),
			recommendations: JSON.stringify(computed.recommendations),
			scoreVersion: computed.scoreVersion,
			createdAt: now,
		})
		.onConflictDoUpdate({
			target: eeatScores.responseId,
			set: {
				overallScore: computed.overallScore,
				factorBreakdown: JSON.stringify(computed.factorBreakdown),
				recommendations: JSON.stringify(computed.recommendations),
				scoreVersion: computed.scoreVersion,
				briefId: response.briefId ?? null,
				createdAt: now,
			},
		})
		.returning();

	if (!row) {
		return null;
	}

	return { row, computed };
}

export async function getLatestEeatScoreForClient(
	clientId: string,
): Promise<EeatScore | null> {
	const row = await db
		.select()
		.from(eeatScores)
		.where(eq(eeatScores.clientId, clientId))
		.orderBy(desc(eeatScores.createdAt))
		.limit(1)
		.get();

	return row ?? null;
}

export async function getEeatScoreTrendForClient(clientId: string, limit = 12) {
	const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 52);

	return db
		.select({
			id: eeatScores.id,
			responseId: eeatScores.responseId,
			questionnaireId: eeatScores.questionnaireId,
			overallScore: eeatScores.overallScore,
			scoreVersion: eeatScores.scoreVersion,
			createdAt: eeatScores.createdAt,
		})
		.from(eeatScores)
		.where(eq(eeatScores.clientId, clientId))
		.orderBy(desc(eeatScores.createdAt))
		.limit(boundedLimit)
		.all();
}
