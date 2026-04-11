/**
 * Ahrefs Integration — Ahrefs API v3
 * Docs: https://docs.ahrefs.com/docs/api/v3
 *
 * Auth: API key stored in dataSources.credentialsEnc as JSON: { "apiKey": "..." }
 * Domain: fetched from clients table via clientId
 */

import { db } from "@/lib/db";
import { dataSources, ahrefsMetrics, clients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { SyncResult, CredentialsApiKey } from "./types";
import { todayString } from "./types";

// ─── Ahrefs API Types ─────────────────────────────────────────────────────────

interface AhrefsDomainRatingResponse {
  domain_rating?: {
    domain: string;
    ahrefs_rank: number;
    domain_rating: number;
  };
  error?: string;
}

interface AhrefsBacklinksStatsResponse {
  metrics?: {
    live: {
      all: {
        backlinks: number;
        referring_domains: number;
        dofollow_links: number;
      };
    };
  };
  error?: string;
}

interface AhrefsOrganicKeywordsResponse {
  positions_metrics?: {
    organic: number;
    positions: number;
    traffic: number;
  };
  error?: string;
}

// ─── Sync Function ────────────────────────────────────────────────────────────

export async function syncAhrefsData(clientId: string): Promise<SyncResult> {
  const source = "AHREFS";

  // 1. Fetch dataSource record
  const dataSource = await db
    .select()
    .from(dataSources)
    .where(
      and(eq(dataSources.clientId, clientId), eq(dataSources.type, "AHREFS"))
    )
    .get();

  if (!dataSource) {
    return { success: false, rowsInserted: 0, error: "Ahrefs data source not configured", source };
  }

  if (!dataSource.isConnected) {
    return { success: false, rowsInserted: 0, error: "Ahrefs not connected", source };
  }

  if (!dataSource.credentialsEnc) {
    return { success: false, rowsInserted: 0, error: "Ahrefs API key missing", source };
  }

  // 2. Parse credentials
  let credentials: CredentialsApiKey;
  try {
    credentials = JSON.parse(dataSource.credentialsEnc) as CredentialsApiKey;
    if (!credentials.apiKey) throw new Error("apiKey missing");
  } catch {
    return { success: false, rowsInserted: 0, error: "Invalid Ahrefs credentials format. Expected JSON: { \"apiKey\": \"...\" }", source };
  }

  // 3. Fetch client domain
  const client = await db
    .select({ domain: clients.domain })
    .from(clients)
    .where(eq(clients.id, clientId))
    .get();

  if (!client?.domain) {
    return { success: false, rowsInserted: 0, error: "Client domain not set", source };
  }

  const { apiKey } = credentials;
  const domain = client.domain;
  const date = todayString();

  try {
    // 4. Call Ahrefs Domain Rating endpoint
    const drUrl = `https://api.ahrefs.com/v3/site-explorer/domain-rating?target=${encodeURIComponent(domain)}&date=today&output=json`;
    const backlinksUrl = `https://api.ahrefs.com/v3/site-explorer/backlinks-stats?target=${encodeURIComponent(domain)}&date=today&mode=domain&output=json`;
    const organicUrl = `https://api.ahrefs.com/v3/site-explorer/positions-metrics?target=${encodeURIComponent(domain)}&mode=domain&output=json`;

    const authHeader = { Authorization: `Bearer ${apiKey}` };

    // Run all three calls in parallel
    const [drResponse, backlinksResponse, organicResponse] = await Promise.all([
      fetch(drUrl, { headers: authHeader }),
      fetch(backlinksUrl, { headers: authHeader }),
      fetch(organicUrl, { headers: authHeader }),
    ]);

    // Parse responses (non-fatal if individual calls fail)
    let domainRating: number | null = null;
    let backlinks = 0;
    let referringDomains = 0;
    let organicKeywords = 0;
    let organicTraffic = 0;

    if (drResponse.ok) {
      const drData = (await drResponse.json()) as AhrefsDomainRatingResponse;
      domainRating = drData.domain_rating?.domain_rating ?? null;
    }

    if (backlinksResponse.ok) {
      const blData = (await backlinksResponse.json()) as AhrefsBacklinksStatsResponse;
      backlinks = blData.metrics?.live?.all?.backlinks ?? 0;
      referringDomains = blData.metrics?.live?.all?.referring_domains ?? 0;
    }

    if (organicResponse.ok) {
      const orgData = (await organicResponse.json()) as AhrefsOrganicKeywordsResponse;
      organicKeywords = orgData.positions_metrics?.organic ?? 0;
      organicTraffic = orgData.positions_metrics?.traffic ?? 0;
    }

    // 5. Upsert into ahrefsMetrics
    await db
      .insert(ahrefsMetrics)
      .values({
        clientId,
        date,
        domainRating,
        urlRating: null,
        backlinks,
        referringDomains,
        organicKeywords,
        organicTraffic,
      })
      .onConflictDoUpdate({
        target: [ahrefsMetrics.clientId, ahrefsMetrics.date],
        set: {
          domainRating,
          backlinks,
          referringDomains,
          organicKeywords,
          organicTraffic,
        },
      });

    // 6. Update lastSyncedAt
    await db
      .update(dataSources)
      .set({ lastSyncedAt: new Date(), lastSyncError: null })
      .where(eq(dataSources.id, dataSource.id));

    return { success: true, rowsInserted: 1, source };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown Ahrefs sync error";

    await db
      .update(dataSources)
      .set({ lastSyncError: errorMsg })
      .where(eq(dataSources.id, dataSource.id));

    return { success: false, rowsInserted: 0, error: errorMsg, source };
  }
}
