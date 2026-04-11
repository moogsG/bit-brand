/**
 * POST /api/sync/[clientId]
 * Sync all (or a specified subset of) connected data sources for a client.
 * Admin only.
 *
 * Body: { sources?: ("GA4" | "GSC" | "AHREFS" | "RANKSCALE" | "SEMRUSH")[] }
 * If sources is omitted or empty, ALL connected sources are synced.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources, clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncGA4Data } from "@/lib/integrations/ga4";
import { syncGSCData } from "@/lib/integrations/gsc";
import { syncAhrefsData } from "@/lib/integrations/ahrefs";
import { syncRankscaleData } from "@/lib/integrations/rankscale";
import { syncSemrushData } from "@/lib/integrations/semrush";
import type { SyncResult } from "@/lib/integrations/types";

type DataSourceType = "GA4" | "GSC" | "AHREFS" | "RANKSCALE" | "SEMRUSH";

const ALL_SOURCE_TYPES: DataSourceType[] = [
  "GA4",
  "GSC",
  "AHREFS",
  "RANKSCALE",
  "SEMRUSH",
];

function isValidSourceType(s: string): s is DataSourceType {
  return ALL_SOURCE_TYPES.includes(s as DataSourceType);
}

async function runSync(
  clientId: string,
  sourceType: DataSourceType
): Promise<SyncResult> {
  switch (sourceType) {
    case "GA4":
      return syncGA4Data(clientId);
    case "GSC":
      return syncGSCData(clientId);
    case "AHREFS":
      return syncAhrefsData(clientId);
    case "RANKSCALE":
      return syncRankscaleData(clientId);
    case "SEMRUSH":
      return syncSemrushData(clientId);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
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
    const body = await req.json() as { sources?: string[] };
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

  // 5. Run syncs in parallel
  const results = await Promise.all(
    sourcesToSync.map((sourceType) => runSync(clientId, sourceType))
  );

  return NextResponse.json({ results });
}
