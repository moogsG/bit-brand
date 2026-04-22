/**
 * DataForSEO Integration — Keyword Data Enrichment
 * Docs: https://docs.dataforseo.com/v3/keywords_data/google/search_volume/live/
 *
 * Auth: Agency-level credentials (login + password) stored encrypted
 *       in apiCredentials table, provider = "DATAFORSEO"
 * Purpose: Enriches existing keyword_research rows with fresh volume + difficulty data
 */

import { db } from "@/lib/db";
import { apiCredentials, dataSources, keywordResearch } from "@/lib/db/schema";
import { eq, and, isNull, or, lte } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import type { SyncResult } from "./types";

// ─── DataForSEO API Types ────────────────────────────────────────────────────

interface DataForSeoResult {
	keyword?: string;
	search_volume?: number;
	keyword_difficulty?: number;
}

interface DataForSeoTask {
	result?: DataForSeoResult[];
}

interface DataForSeoResponse {
	tasks?: DataForSeoTask[];
}

// ─── Sync Function ────────────────────────────────────────────────────────────

export async function syncDataForSeoData(
	clientId: string,
): Promise<SyncResult> {
	const source = "DATAFORSEO";

	try {
		// 1. Read agency credential
		const credential = db
			.select()
			.from(apiCredentials)
			.where(
				and(
					eq(apiCredentials.provider, "DATAFORSEO"),
					eq(apiCredentials.isActive, true),
				),
			)
			.get();

		if (!credential) {
			return {
				success: false,
				rowsInserted: 0,
				error: "No active DATAFORSEO credential configured",
				source,
			};
		}

		// 2. Decrypt credentials
		const creds = JSON.parse(decrypt(credential.credentialsEnc));
		const { login, password } = creds;

		if (!login || !password) {
			return {
				success: false,
				rowsInserted: 0,
				error: "DATAFORSEO credentials missing login or password",
				source,
			};
		}

		// 3. Check data source is connected
		const dataSource = db
			.select()
			.from(dataSources)
			.where(
				and(
					eq(dataSources.clientId, clientId),
					eq(dataSources.type, "DATAFORSEO"),
				),
			)
			.get();

		if (!dataSource?.isConnected) {
			return {
				success: false,
				rowsInserted: 0,
				error: "DATAFORSEO not connected for this client",
				source,
			};
		}

		// 4. Get keywords needing enrichment (never enriched or older than 30 days)
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const keywords = db
			.select()
			.from(keywordResearch)
			.where(
				and(
					eq(keywordResearch.clientId, clientId),
					or(
						isNull(keywordResearch.lastEnrichedAt),
						lte(keywordResearch.lastEnrichedAt, thirtyDaysAgo),
					),
				),
			)
			.all();

		if (keywords.length === 0) {
			// Nothing to enrich — not an error
			db.update(dataSources)
				.set({ lastSyncedAt: new Date(), lastSyncError: null })
				.where(eq(dataSources.id, dataSource.id))
				.run();

			return { success: true, rowsInserted: 0, source };
		}

		// 5. Batch keywords (100 per request)
		const authHeader = Buffer.from(`${login}:${password}`).toString("base64");
		let totalUpdated = 0;

		for (let i = 0; i < keywords.length; i += 100) {
			const batch = keywords.slice(i, i + 100);

			const response = await fetch(
				"https://api.dataforseo.com/v3/keywords_data/google/search_volume/live",
				{
					method: "POST",
					headers: {
						Authorization: `Basic ${authHeader}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(
						batch.map((k) => ({
							keywords: [k.keyword],
							language_code: "en",
							location_code: 2840, // US
						})),
					),
				},
			);

			if (!response.ok) {
				throw new Error(
					`DataForSEO API error: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as DataForSeoResponse;

			// 6. Update keywords with enrichment data
			if (data.tasks) {
				for (const task of data.tasks) {
					if (task.result) {
						for (const result of task.result) {
							const keyword = keywords.find(
								(k) =>
									k.keyword.toLowerCase() === result.keyword?.toLowerCase(),
							);
							if (keyword) {
								db.update(keywordResearch)
									.set({
										monthlyVolume:
											result.search_volume ?? keyword.monthlyVolume,
										difficulty:
											result.keyword_difficulty != null
												? Math.round(result.keyword_difficulty)
												: keyword.difficulty,
										lastEnrichedAt: new Date(),
										updatedAt: new Date(),
									})
									.where(eq(keywordResearch.id, keyword.id))
									.run();
								totalUpdated++;
							}
						}
					}
				}
			}
		}

		// 7. Update sync status
		db.update(dataSources)
			.set({ lastSyncedAt: new Date(), lastSyncError: null })
			.where(eq(dataSources.id, dataSource.id))
			.run();

		return { success: true, rowsInserted: totalUpdated, source };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown DataForSEO sync error";

		// Update error status on the data source
		const dataSource = db
			.select()
			.from(dataSources)
			.where(
				and(
					eq(dataSources.clientId, clientId),
					eq(dataSources.type, "DATAFORSEO"),
				),
			)
			.get();

		if (dataSource) {
			db.update(dataSources)
				.set({ lastSyncError: errorMessage })
				.where(eq(dataSources.id, dataSource.id))
				.run();
		}

		return { success: false, rowsInserted: 0, error: errorMessage, source };
	}
}
