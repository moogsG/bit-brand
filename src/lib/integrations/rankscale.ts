/**
 * Rankscale Integration — AI Visibility for tested prompts
 *
 * TODO: Confirm actual Rankscale API endpoint and response shape.
 *       The base URL and response structure below are placeholders based on
 *       known product capabilities. Update when real API docs are available.
 *
 * API key stored in apiCredentials table (agency-level).
 * Domain: fetched from clients table via clientId.
 */

import { db } from "@/lib/db";
import {
	dataSources,
	rankscaleMetrics,
	aiVisibility,
	apiCredentials,
	clients,
} from "@/lib/db/schema";
import { eq, and, avg, count, sql } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import type { SyncResult } from "./types";
import { todayString } from "./types";

// ─── Rankscale API Types ──────────────────────────────────────────────────────

interface RankscalePrompt {
	prompt: string;
	platform: string;
	isVisible: boolean;
	position?: number | null;
	responseSnippet?: string | null;
	visibilityScore?: number | null;
}

interface RankscaleVisibilityResponse {
	prompts?: RankscalePrompt[];
	error?: string;
	message?: string;
}

// ─── Sync Function ────────────────────────────────────────────────────────────

export async function syncRankscaleData(clientId: string): Promise<SyncResult> {
	const source = "RANKSCALE";

	// 1. Fetch dataSource record
	const dataSource = await db
		.select()
		.from(dataSources)
		.where(
			and(
				eq(dataSources.clientId, clientId),
				eq(dataSources.type, "RANKSCALE"),
			),
		)
		.get();

	if (!dataSource) {
		return {
			success: false,
			rowsInserted: 0,
			error: "Rankscale data source not configured",
			source,
		};
	}

	if (!dataSource.isConnected) {
		return {
			success: false,
			rowsInserted: 0,
			error: "Rankscale not connected",
			source,
		};
	}

	// 2. Fetch agency-level credentials from apiCredentials table
	const cred = await db
		.select()
		.from(apiCredentials)
		.where(eq(apiCredentials.provider, "RANKSCALE"))
		.get();

	if (!cred) {
		return {
			success: false,
			rowsInserted: 0,
			error: "Rankscale API credentials not configured (agency-level)",
			source,
		};
	}

	let credentials: { apiKey: string };
	try {
		credentials = JSON.parse(decrypt(cred.credentialsEnc)) as {
			apiKey: string;
		};
		if (!credentials.apiKey) throw new Error("apiKey missing");
	} catch {
		return {
			success: false,
			rowsInserted: 0,
			error: "Invalid Rankscale credentials format",
			source,
		};
	}

	// 3. Fetch client domain
	const client = await db
		.select({ domain: clients.domain })
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	if (!client?.domain) {
		return {
			success: false,
			rowsInserted: 0,
			error: "Client domain not set",
			source,
		};
	}

	const { apiKey } = credentials;
	const domain = client.domain;
	const date = todayString();

	try {
		// 4. Call Rankscale API
		// TODO: Replace with confirmed API endpoint once Rankscale documentation is verified.
		//       Current endpoint is a placeholder based on known product structure.
		const apiUrl = `https://api.rankscale.io/v1/visibility?apiKey=${encodeURIComponent(apiKey)}&domain=${encodeURIComponent(domain)}`;

		const response = await fetch(apiUrl, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Rankscale API error ${response.status}: ${errorText}`);
		}

		const data = (await response.json()) as RankscaleVisibilityResponse;

		if (data.error) {
			throw new Error(`Rankscale API error: ${data.error}`);
		}

		const prompts = data.prompts ?? [];

		// 5. Upsert prompt-level rows into rankscaleMetrics
		let rowsInserted = 0;

		for (const prompt of prompts) {
			await db
				.insert(rankscaleMetrics)
				.values({
					clientId,
					date,
					prompt: prompt.prompt,
					platform: prompt.platform,
					isVisible: prompt.isVisible,
					position: prompt.position ?? null,
					responseSnippet: prompt.responseSnippet ?? null,
					visibilityScore: prompt.visibilityScore ?? null,
				})
				.onConflictDoNothing(); // index is non-unique; skip exact duplicates

			rowsInserted++;
		}

		// 6. Compute aggregate scores for aiVisibility table
		await updateAiVisibilityAggregate(clientId, date);

		// 7. Update lastSyncedAt
		await db
			.update(dataSources)
			.set({ lastSyncedAt: new Date(), lastSyncError: null })
			.where(eq(dataSources.id, dataSource.id));

		return { success: true, rowsInserted, source };
	} catch (err) {
		const errorMsg =
			err instanceof Error ? err.message : "Unknown Rankscale sync error";

		await db
			.update(dataSources)
			.set({ lastSyncError: errorMsg })
			.where(eq(dataSources.id, dataSource.id));

		return { success: false, rowsInserted: 0, error: errorMsg, source };
	}
}

// ─── Aggregate Helper ────────────────────────────────────────────────────────

/**
 * Recomputes the aiVisibility aggregate for a given clientId + date.
 * Called after Rankscale sync to keep the overall AI visibility score current.
 * Overall score is currently purely Rankscale-based.
 */
export async function updateAiVisibilityAggregate(
	clientId: string,
	date: string,
): Promise<void> {
	// Compute Rankscale stats for this date
	const rankscaleStats = await db
		.select({
			totalPrompts: count(rankscaleMetrics.id),
			visiblePrompts: count(
				sql`CASE WHEN ${rankscaleMetrics.isVisible} = 1 THEN 1 END`,
			),
			avgScore: avg(rankscaleMetrics.visibilityScore),
		})
		.from(rankscaleMetrics)
		.where(
			and(
				eq(rankscaleMetrics.clientId, clientId),
				eq(rankscaleMetrics.date, date),
			),
		)
		.get();

	const rankscaleScore =
		rankscaleStats?.avgScore != null
			? parseFloat(String(rankscaleStats.avgScore))
			: null;
	const totalPromptsTested = rankscaleStats?.totalPrompts ?? 0;
	const promptsVisible = rankscaleStats?.visiblePrompts ?? 0;

	// Overall score is currently purely Rankscale-based
	const overallScore = rankscaleScore;

	// Upsert into aiVisibility
	await db
		.insert(aiVisibility)
		.values({
			clientId,
			date,
			overallScore,
			rankscaleScore,
			totalPromptsTested,
			promptsVisible,
		})
		.onConflictDoUpdate({
			target: [aiVisibility.clientId, aiVisibility.date],
			set: {
				overallScore,
				rankscaleScore,
				totalPromptsTested,
				promptsVisible,
			},
		});
}
