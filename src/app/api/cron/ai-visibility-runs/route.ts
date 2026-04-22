import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { executeAiVisibilityRun } from "@/lib/ai/visibility-runner";
import { db } from "@/lib/db";
import {
	aiVisibilityPromptSets,
	aiVisibilityPrompts,
	aiVisibilityRuns,
	clients,
} from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";

const AI_VISIBILITY_CRON_VERSION = "1.0.0" as const;

const DEFAULT_LIMITS = {
	maxClients: 10,
	maxPromptSets: 25,
	maxRuns: 25,
} as const;

interface CronRequestPayload {
	dryRun?: boolean;
	maxClients?: number;
	maxPromptSets?: number;
	maxRuns?: number;
}

interface CronFailure {
	clientId: string;
	promptSetId: string;
	error: string;
}

function parseBoolean(value: string | null | undefined): boolean | undefined {
	if (value === null || value === undefined) return undefined;
	switch (value.trim().toLowerCase()) {
		case "1":
		case "true":
		case "yes":
		case "on":
			return true;
		case "0":
		case "false":
		case "no":
		case "off":
			return false;
		default:
			return undefined;
	}
}

function parsePositiveInt(
	value: unknown,
	fallback: number,
	min = 1,
	max = 200,
): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.min(max, Math.max(min, Math.trunc(value)));
	}
	if (typeof value === "string" && value.trim()) {
		const n = Number.parseInt(value, 10);
		if (Number.isFinite(n)) {
			return Math.min(max, Math.max(min, n));
		}
	}
	return fallback;
}

async function tryParseJsonBody(request: NextRequest): Promise<CronRequestPayload> {
	try {
		const text = await request.text();
		if (!text.trim()) return {};
		return JSON.parse(text) as CronRequestPayload;
	} catch {
		return {};
	}
}

export async function POST(request: NextRequest) {
	if (!phase2Flags.aiVisibilityV1() || !phase2Flags.aiVisibilityCronV1()) {
		return NextResponse.json(
			{
				version: AI_VISIBILITY_CRON_VERSION,
				success: false,
				data: null,
				error: {
					code: "MODULE_DISABLED",
					message:
						"AI visibility cron endpoint disabled (requires FF_AI_VISIBILITY_V1=true and FF_AI_VISIBILITY_CRON_V1=true)",
				},
			},
			{ status: 404 },
		);
	}

	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json(
			{
				version: AI_VISIBILITY_CRON_VERSION,
				success: false,
				data: null,
				error: { code: "UNAUTHORIZED", message: "Unauthorized" },
			},
			{ status: 401 },
		);
	}

	const query = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
	const body = await tryParseJsonBody(request);

	const dryRun =
		parseBoolean(query.get("dryRun")) ??
		(typeof body.dryRun === "boolean" ? body.dryRun : false);

	const maxClients = parsePositiveInt(
		query.get("maxClients") ?? body.maxClients,
		DEFAULT_LIMITS.maxClients,
	);
	const maxPromptSets = parsePositiveInt(
		query.get("maxPromptSets") ?? body.maxPromptSets,
		DEFAULT_LIMITS.maxPromptSets,
	);
	const maxRuns = parsePositiveInt(
		query.get("maxRuns") ?? body.maxRuns,
		DEFAULT_LIMITS.maxRuns,
	);

	const activeClients = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.isActive, true))
		.limit(maxClients)
		.all();

	let scannedPromptSets = 0;
	let eligiblePromptSets = 0;
	let skippedPromptSets = 0;
	let createdRuns = 0;
	let executedRuns = 0;
	let succeededRuns = 0;
	let failedRuns = 0;
	const failures: CronFailure[] = [];

	for (const client of activeClients) {
		if (scannedPromptSets >= maxPromptSets || createdRuns >= maxRuns) break;

		const remainingSets = maxPromptSets - scannedPromptSets;
		const promptSets = await db
			.select({
				id: aiVisibilityPromptSets.id,
				clientId: aiVisibilityPromptSets.clientId,
				updatedBy: aiVisibilityPromptSets.updatedBy,
			})
			.from(aiVisibilityPromptSets)
			.where(
				and(
					eq(aiVisibilityPromptSets.clientId, client.id),
					eq(aiVisibilityPromptSets.isActive, true),
				),
			)
			.limit(remainingSets)
			.all();

		for (const promptSet of promptSets) {
			if (scannedPromptSets >= maxPromptSets || createdRuns >= maxRuns) break;
			scannedPromptSets += 1;

			const hasActivePrompt = await db
				.select({ id: aiVisibilityPrompts.id })
				.from(aiVisibilityPrompts)
				.where(
					and(
						eq(aiVisibilityPrompts.promptSetId, promptSet.id),
						eq(aiVisibilityPrompts.isActive, true),
					),
				)
				.limit(1)
				.get();

			if (!hasActivePrompt) {
				skippedPromptSets += 1;
				continue;
			}

			eligiblePromptSets += 1;

			if (dryRun) {
				createdRuns += 1;
				continue;
			}

			try {
				const [created] = await db
					.insert(aiVisibilityRuns)
					.values({
						clientId: promptSet.clientId,
						promptSetId: promptSet.id,
						engines: JSON.stringify(["CHATGPT", "PERPLEXITY", "GEMINI"]),
						status: "PENDING",
						triggeredBy: promptSet.updatedBy,
						updatedAt: new Date(),
					})
					.returning();

				if (!created?.id) {
					failedRuns += 1;
					failures.push({
						clientId: promptSet.clientId,
						promptSetId: promptSet.id,
						error: "Failed to create run",
					});
					continue;
				}

				createdRuns += 1;
				executedRuns += 1;

				const execution = await executeAiVisibilityRun(created.id);
				if (execution.status === "SUCCESS") {
					succeededRuns += 1;
				} else {
					failedRuns += 1;
					failures.push({
						clientId: promptSet.clientId,
						promptSetId: promptSet.id,
						error: `Run status ${execution.status}`,
					});
				}
			} catch (error) {
				failedRuns += 1;
				failures.push({
					clientId: promptSet.clientId,
					promptSetId: promptSet.id,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}
	}

	return NextResponse.json({
		version: AI_VISIBILITY_CRON_VERSION,
		success: true,
		data: {
			dryRun,
			limits: { maxClients, maxPromptSets, maxRuns },
			counts: {
				activeClients: activeClients.length,
				scannedPromptSets,
				eligiblePromptSets,
				skippedPromptSets,
				createdRuns,
				executedRuns,
				succeededRuns,
				failedRuns,
			},
			failures,
			timestamp: new Date().toISOString(),
		},
		error: null,
	});
}
