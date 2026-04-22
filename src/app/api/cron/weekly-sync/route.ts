/**
 * POST /api/cron/weekly-sync
 * Weekly cron job that syncs all connected data sources for all active clients.
 * Authenticated via CRON_SECRET bearer token.
 *
 * Processes clients in batches of 3 to avoid overloading external APIs.
 * Creates syncJobs records for each sync operation.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, dataSources, syncJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { syncGA4Data } from "@/lib/integrations/ga4";
import { syncGSCData } from "@/lib/integrations/gsc";
import { syncMozData } from "@/lib/integrations/moz";
import { syncDataForSeoData } from "@/lib/integrations/dataforseo";
import { syncRankscaleData } from "@/lib/integrations/rankscale";
import type { SyncResult } from "@/lib/integrations/types";

const syncFunctions: Record<string, (clientId: string) => Promise<SyncResult>> =
	{
		GA4: syncGA4Data,
		GSC: syncGSCData,
		MOZ: syncMozData,
		DATAFORSEO: syncDataForSeoData,
		RANKSCALE: syncRankscaleData,
	};

export async function POST(request: NextRequest) {
	// Verify CRON_SECRET
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Get all active clients
	const activeClients = db
		.select()
		.from(clients)
		.where(eq(clients.isActive, true))
		.all();

	let totalSyncs = 0;
	let successfulSyncs = 0;
	let failedSyncs = 0;

	// Process clients in batches of 3
	for (let i = 0; i < activeClients.length; i += 3) {
		const batch = activeClients.slice(i, i + 3);
		const batchResults = await Promise.allSettled(
			batch.map((client) => syncAllSourcesForClient(client.id)),
		);

		for (const result of batchResults) {
			if (result.status === "fulfilled") {
				totalSyncs += result.value.total;
				successfulSyncs += result.value.success;
				failedSyncs += result.value.failed;
			} else {
				failedSyncs++;
			}
		}
	}

	return NextResponse.json({
		success: true,
		totalClients: activeClients.length,
		totalSyncs,
		successfulSyncs,
		failedSyncs,
		timestamp: new Date().toISOString(),
	});
}

async function syncAllSourcesForClient(clientId: string) {
	const sources = db
		.select()
		.from(dataSources)
		.where(
			and(
				eq(dataSources.clientId, clientId),
				eq(dataSources.isConnected, true),
			),
		)
		.all();

	let total = 0;
	let success = 0;
	let failed = 0;

	await Promise.allSettled(
		sources.map(async (source) => {
			const syncFn = syncFunctions[source.type];
			if (!syncFn) return;

			total++;

			// Create sync job
			const jobId = crypto.randomUUID();
			db.insert(syncJobs)
				.values({
					id: jobId,
					clientId,
					source: source.type,
					status: "RUNNING",
					startedAt: new Date(),
					triggeredBy: "SCHEDULER",
				})
				.run();

			try {
				const result = await syncFn(clientId);

				db.update(syncJobs)
					.set({
						status: result.success ? "SUCCESS" : "FAILED",
						completedAt: new Date(),
						rowsInserted: result.rowsInserted,
						error: result.error || null,
					})
					.where(eq(syncJobs.id, jobId))
					.run();

				if (result.success) success++;
				else failed++;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				db.update(syncJobs)
					.set({
						status: "FAILED",
						completedAt: new Date(),
						error: errorMessage,
					})
					.where(eq(syncJobs.id, jobId))
					.run();
				failed++;
			}
		}),
	);

	return { total, success, failed };
}
