/**
 * POST /api/sync/[clientId]
 * Sync all (or a specified subset of) connected data sources for a client.
 * Admin only.
 *
 * Body: { sources?: ("GA4" | "GSC" | "MOZ" | "RANKSCALE" | "DATAFORSEO")[] }
 * If sources is omitted or empty, ALL connected sources are synced.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources, clients, syncJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncGA4Data } from "@/lib/integrations/ga4";
import { syncGSCData } from "@/lib/integrations/gsc";
import { syncMozData } from "@/lib/integrations/moz";
import { syncRankscaleData } from "@/lib/integrations/rankscale";
import { syncDataForSeoData } from "@/lib/integrations/dataforseo";
import type { SyncResult } from "@/lib/integrations/types";

type DataSourceType = "GA4" | "GSC" | "MOZ" | "RANKSCALE" | "DATAFORSEO";

const ALL_SOURCE_TYPES: DataSourceType[] = [
	"GA4",
	"GSC",
	"MOZ",
	"RANKSCALE",
	"DATAFORSEO",
];

function isValidSourceType(s: string): s is DataSourceType {
	return ALL_SOURCE_TYPES.includes(s as DataSourceType);
}

async function runSync(
	clientId: string,
	sourceType: DataSourceType,
): Promise<SyncResult> {
	switch (sourceType) {
		case "GA4":
			return syncGA4Data(clientId);
		case "GSC":
			return syncGSCData(clientId);
		case "MOZ":
			return syncMozData(clientId);
		case "RANKSCALE":
			return syncRankscaleData(clientId);
		case "DATAFORSEO":
			return syncDataForSeoData(clientId);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ clientId: string }> },
) {
	// 1. Auth check — Admin only
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { clientId } = await params;

	// 2. Verify client exists
	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	if (!client) {
		return NextResponse.json({ error: "Client not found" }, { status: 404 });
	}

	// 3. Parse request body
	let requestedSources: DataSourceType[] = [];
	try {
		const body = (await req.json()) as { sources?: string[] };
		if (body.sources && Array.isArray(body.sources)) {
			requestedSources = body.sources.filter(isValidSourceType);
		}
	} catch {
		// Body is optional — proceed with all sources
	}

	// 4. Determine which sources to sync
	let sourcesToSync: DataSourceType[];

	if (requestedSources.length > 0) {
		sourcesToSync = requestedSources;
	} else {
		// Sync all connected sources
		const connectedSources = await db
			.select({ type: dataSources.type })
			.from(dataSources)
			.where(eq(dataSources.clientId, clientId));

		sourcesToSync = connectedSources
			.map((s) => s.type)
			.filter(isValidSourceType);

		if (sourcesToSync.length === 0) {
			return NextResponse.json({
				results: [],
				message: "No connected data sources found for this client",
			});
		}
	}

	// 5. Run syncs in parallel with job tracking
	const results = await Promise.all(
		sourcesToSync.map(async (sourceType) => {
			const jobId = crypto.randomUUID();
			db.insert(syncJobs)
				.values({
					id: jobId,
					clientId,
					source: sourceType,
					status: "RUNNING",
					startedAt: new Date(),
					triggeredBy: "MANUAL",
				})
				.run();

			try {
				const result = await runSync(clientId, sourceType);

				db.update(syncJobs)
					.set({
						status: result.success ? "SUCCESS" : "FAILED",
						completedAt: new Date(),
						rowsInserted: result.rowsInserted,
						error: result.error || null,
					})
					.where(eq(syncJobs.id, jobId))
					.run();

				return result;
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

				return {
					success: false,
					rowsInserted: 0,
					error: errorMessage,
					source: sourceType,
				} as SyncResult;
			}
		}),
	);

	return NextResponse.json({ results });
}
