/**
 * POST /api/sync/[clientId]/[source]
 * Sync a single data source for a client.
 * Admin only.
 *
 * source: GA4 | GSC | AHREFS | RANKSCALE | SEMRUSH
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncGA4Data } from "@/lib/integrations/ga4";
import { syncGSCData } from "@/lib/integrations/gsc";
import { syncAhrefsData } from "@/lib/integrations/ahrefs";
import { syncRankscaleData } from "@/lib/integrations/rankscale";
import { syncSemrushData } from "@/lib/integrations/semrush";
import type { SyncResult } from "@/lib/integrations/types";

type DataSourceType = "GA4" | "GSC" | "AHREFS" | "RANKSCALE" | "SEMRUSH";

const VALID_SOURCES: DataSourceType[] = [
  "GA4",
  "GSC",
  "AHREFS",
  "RANKSCALE",
  "SEMRUSH",
];

function isValidSourceType(s: string): s is DataSourceType {
  return VALID_SOURCES.includes(s as DataSourceType);
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
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; source: string }> }
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
      { status: 400 }
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

  // 4. Run the sync
  const result = await runSync(clientId, upperSource);

  return NextResponse.json(result);
}
