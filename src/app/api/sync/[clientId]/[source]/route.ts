/**
 * POST /api/sync/[clientId]/[source]
 * Sync a single data source for a client.
 * Admin only.
 *
 * source: GA4 | GSC | MOZ | RANKSCALE | DATAFORSEO
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, syncJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncGA4Data } from "@/lib/integrations/ga4";
import { syncGSCData } from "@/lib/integrations/gsc";
import { syncMozData } from "@/lib/integrations/moz";
import { syncRankscaleData } from "@/lib/integrations/rankscale";
import { syncDataForSeoData } from "@/lib/integrations/dataforseo";
import type { SyncResult } from "@/lib/integrations/types";

type DataSourceType = "GA4" | "GSC" | "MOZ" | "RANKSCALE" | "DATAFORSEO";

const VALID_SOURCES: DataSourceType[] = [
	"GA4",
	"GSC",
	"MOZ",
	"RANKSCALE",
	"DATAFORSEO",
];

function isValidSourceType(s: string): s is DataSourceType {
	return VALID_SOURCES.includes(s as DataSourceType);
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
	_req: NextRequest,
	{ params }: { params: Promise<{ clientId: string; source: string }> },
) {
	// 1. Auth check — Admin only
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { clientId, source } = await params;

	// 2. Validate source type
	const upperSource = source.toUpperCase();
	if (!isValidSourceType(upperSource)) {
		return NextResponse.json(
			{
				error: `Invalid source type: "${source}". Must be one of: ${VALID_SOURCES.join(", ")}`,
			},
			{ status: 400 },
		);
	}

	// 3. Verify client exists
	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	if (!client) {
		return NextResponse.json({ error: "Client not found" }, { status: 404 });
	}

	// 4. Run the sync with job tracking
	const jobId = crypto.randomUUID();
	db.insert(syncJobs)
		.values({
			id: jobId,
			clientId,
			source: upperSource,
			status: "RUNNING",
			startedAt: new Date(),
			triggeredBy: "MANUAL",
		})
		.run();

	try {
		const result = await runSync(clientId, upperSource);

		db.update(syncJobs)
			.set({
				status: result.success ? "SUCCESS" : "FAILED",
				completedAt: new Date(),
				rowsInserted: result.rowsInserted,
				error: result.error || null,
			})
			.where(eq(syncJobs.id, jobId))
			.run();

		return NextResponse.json(result);
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

		return NextResponse.json(
			{
				success: false,
				rowsInserted: 0,
				error: errorMessage,
				source: upperSource,
			},
			{ status: 500 },
		);
	}
}
