/**
 * GSC Integration — Google Search Console API
 * Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 *
 * Auth: OAuth 2.0 access token stored in dataSources.accessToken
 * Site URL: stored in dataSources.siteUrl
 */

import { db } from "@/lib/db";
import { dataSources, gscMetrics } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { SyncResult } from "./types";
import { daysAgoString, todayString } from "./types";

// ─── GSC API Types ────────────────────────────────────────────────────────────

interface GSCRow {
  keys: string[]; // [date, query] based on dimensions requested
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCQueryResponse {
  rows?: GSCRow[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ─── Sync Function ────────────────────────────────────────────────────────────

export async function syncGSCData(
  clientId: string,
  daysBack = 90
): Promise<SyncResult> {
  const source = "GSC";

  // 1. Fetch dataSource record
  const dataSource = await db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.clientId, clientId), eq(dataSources.type, "GSC")))
    .get();

  if (!dataSource) {
    return { success: false, rowsInserted: 0, error: "GSC data source not configured", source };
  }

  if (!dataSource.isConnected) {
    return { success: false, rowsInserted: 0, error: "GSC not connected", source };
  }

  if (!dataSource.accessToken) {
    return { success: false, rowsInserted: 0, error: "GSC access token missing. Add token manually for POC testing.", source };
  }

  if (!dataSource.siteUrl) {
    return { success: false, rowsInserted: 0, error: "GSC site URL not set", source };
  }

  try {
    // 2. Call GSC Search Analytics API
    // siteUrl must be URL-encoded in the path
    const encodedSiteUrl = encodeURIComponent(dataSource.siteUrl);
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

    const startDate = daysAgoString(daysBack);
    const endDate = todayString();

    const requestBody = {
      startDate,
      endDate,
      dimensions: ["date", "query"],
      rowLimit: 1000,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dataSource.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GSC API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as GSCQueryResponse;

    if (data.error) {
      throw new Error(`GSC API error: ${data.error.message}`);
    }

    const rows = data.rows ?? [];

    // 3. Upsert into gscMetrics table
    let rowsInserted = 0;

    for (const row of rows) {
      const date = row.keys[0] ?? "";
      const query = row.keys[1] ?? "";

      if (!date || !query) continue;

      await db
        .insert(gscMetrics)
        .values({
          clientId,
          date,
          query,
          page: null,
          clicks: Math.round(row.clicks),
          impressions: Math.round(row.impressions),
          ctr: row.ctr,
          position: row.position,
        })
        .onConflictDoNothing(); // gsc uses a non-unique index; skip duplicates

      rowsInserted++;
    }

    // 4. Update lastSyncedAt
    await db
      .update(dataSources)
      .set({ lastSyncedAt: new Date(), lastSyncError: null })
      .where(eq(dataSources.id, dataSource.id));

    return { success: true, rowsInserted, source };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown GSC sync error";

    await db
      .update(dataSources)
      .set({ lastSyncError: errorMsg })
      .where(eq(dataSources.id, dataSource.id));

    return { success: false, rowsInserted: 0, error: errorMsg, source };
  }
}
