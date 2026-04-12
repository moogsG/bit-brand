/**
 * Moz Integration — Moz Links API v2
 * Docs: https://moz.com/help/links-api
 *
 * Auth: Agency-level credentials (accessId + secretKey) stored encrypted
 *       in apiCredentials table, provider = "MOZ"
 * Domain: fetched from clients table via clientId
 */

import { db } from "@/lib/db";
import {
	apiCredentials,
	dataSources,
	mozMetrics,
	clients,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import type { SyncResult } from "./types";
import { todayString } from "./types";

// ─── Moz API Types ───────────────────────────────────────────────────────────

interface MozUrlMetrics {
	domain_authority?: number;
	page_authority?: number;
	spam_score?: number;
	brand_authority?: number;
	external_pages_to_root_domain?: number;
	root_domains_to_root_domain?: number;
}

interface MozApiResponse {
	results?: MozUrlMetrics[];
	error?: string;
}

// ─── Sync Function ────────────────────────────────────────────────────────────

export async function syncMozData(clientId: string): Promise<SyncResult> {
	const source = "MOZ";

	try {
		// 1. Read agency credential
		const credential = db
			.select()
			.from(apiCredentials)
			.where(
				and(
					eq(apiCredentials.provider, "MOZ"),
					eq(apiCredentials.isActive, true),
				),
			)
			.get();

		if (!credential) {
			return {
				success: false,
				rowsInserted: 0,
				error: "No active MOZ credential configured",
				source,
			};
		}

		// 2. Decrypt credentials
		const creds = JSON.parse(decrypt(credential.credentialsEnc));
		const { accessId, secretKey } = creds;

		if (!accessId || !secretKey) {
			return {
				success: false,
				rowsInserted: 0,
				error: "MOZ credentials missing accessId or secretKey",
				source,
			};
		}

		// 3. Read client domain
		const client = db
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

		// 4. Read data source config
		const dataSource = db
			.select()
			.from(dataSources)
			.where(
				and(eq(dataSources.clientId, clientId), eq(dataSources.type, "MOZ")),
			)
			.get();

		if (!dataSource?.isConnected) {
			return {
				success: false,
				rowsInserted: 0,
				error: "MOZ not connected for this client",
				source,
			};
		}

		// 5. Call Moz Links API
		const authHeader = Buffer.from(`${accessId}:${secretKey}`).toString(
			"base64",
		);
		const response = await fetch("https://lsapi.seomoz.com/v2/url_metrics", {
			method: "POST",
			headers: {
				Authorization: `Basic ${authHeader}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				targets: [client.domain],
			}),
		});

		if (!response.ok) {
			throw new Error(
				`Moz API error: ${response.status} ${response.statusText}`,
			);
		}

		const data = (await response.json()) as MozApiResponse;
		const metrics: MozUrlMetrics = data.results?.[0] ?? (data as MozUrlMetrics);

		// 6. Upsert into mozMetrics
		const today = todayString();

		const values = {
			domainAuthority: Math.round(metrics.domain_authority ?? 0),
			pageAuthority: Math.round(metrics.page_authority ?? 0),
			spamScore: Math.round(metrics.spam_score ?? 0),
			brandAuthority: metrics.brand_authority
				? Math.round(metrics.brand_authority)
				: null,
			backlinks: metrics.external_pages_to_root_domain ?? 0,
			referringDomains: metrics.root_domains_to_root_domain ?? 0,
		};

		db.insert(mozMetrics)
			.values({
				clientId,
				date: today,
				...values,
			})
			.onConflictDoUpdate({
				target: [mozMetrics.clientId, mozMetrics.date],
				set: values,
			})
			.run();

		// 7. Update sync status
		db.update(dataSources)
			.set({ lastSyncedAt: new Date(), lastSyncError: null })
			.where(eq(dataSources.id, dataSource.id))
			.run();

		return { success: true, rowsInserted: 1, source };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown Moz sync error";

		// Update error status on the data source
		const dataSource = db
			.select()
			.from(dataSources)
			.where(
				and(eq(dataSources.clientId, clientId), eq(dataSources.type, "MOZ")),
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
