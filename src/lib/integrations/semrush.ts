/**
 * SEMrush Integration — AI Visibility metrics
 *
 * TODO: Confirm the exact AI overview endpoint once SEMrush API docs are verified.
 *       The projectId-based endpoint below is a placeholder.
 *       SEMrush AI visibility may require a paid "AI Overview Tracking" project.
 *
 * Auth: API key stored in dataSources.credentialsEnc as JSON: { "apiKey": "...", "projectId": "..." }
 * Project ID: also stored in dataSources.propertyId (secondary location)
 */

import { db } from "@/lib/db";
import {
  dataSources,
  semrushMetrics,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { SyncResult, CredentialsApiKey } from "./types";
import { todayString } from "./types";
import { updateAiVisibilityAggregate } from "./rankscale";

// ─── SEMrush API Types ────────────────────────────────────────────────────────

interface SEMrushAIOverviewItem {
  platform?: string;
  ai_visibility_score?: number;
  brand_mentions?: number;
  competitor_comparison?: Record<string, unknown>;
}

interface SEMrushAIOverviewResponse {
  data?: SEMrushAIOverviewItem[];
  error?: string;
  message?: string;
}

// ─── Sync Function ────────────────────────────────────────────────────────────

export async function syncSemrushData(clientId: string): Promise<SyncResult> {
  const source = "SEMRUSH";

  // 1. Fetch dataSource record
  const dataSource = await db
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.clientId, clientId),
        eq(dataSources.type, "SEMRUSH")
      )
    )
    .get();

  if (!dataSource) {
    return { success: false, rowsInserted: 0, error: "SEMrush data source not configured", source };
  }

  if (!dataSource.isConnected) {
    return { success: false, rowsInserted: 0, error: "SEMrush not connected", source };
  }

  if (!dataSource.credentialsEnc) {
    return { success: false, rowsInserted: 0, error: "SEMrush API key missing", source };
  }

  // 2. Parse credentials
  let credentials: CredentialsApiKey;
  try {
    credentials = JSON.parse(dataSource.credentialsEnc) as CredentialsApiKey;
    if (!credentials.apiKey) throw new Error("apiKey missing");
  } catch {
    return {
      success: false,
      rowsInserted: 0,
      error: "Invalid SEMrush credentials format. Expected JSON: { \"apiKey\": \"...\", \"projectId\": \"...\" }",
      source,
    };
  }

  // 3. Resolve project ID (prefer credentialsEnc.projectId, fall back to propertyId)
  const projectId = credentials.projectId ?? dataSource.propertyId;

  if (!projectId) {
    return {
      success: false,
      rowsInserted: 0,
      error: "SEMrush project ID not set. Add projectId to credentials JSON or set propertyId.",
      source,
    };
  }

  const { apiKey } = credentials;
  const date = todayString();

  try {
    // 5. Call SEMrush AI Overview endpoint
    // TODO: Replace with the confirmed endpoint once SEMrush API docs are verified.
    //       SEMrush may use a different path for AI visibility data.
    const apiUrl = `https://api.semrush.com/reports/v1/projects/${encodeURIComponent(projectId)}/ai-overview?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SEMrush API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as SEMrushAIOverviewResponse;

    if (data.error) {
      throw new Error(`SEMrush API error: ${data.error}`);
    }

    const items = data.data ?? [];
    let rowsInserted = 0;

    // 6. Upsert each platform row into semrushMetrics
    for (const item of items) {
      const platform = item.platform ?? "overall";
      const aiVisibilityScore = item.ai_visibility_score ?? null;
      const brandMentions = item.brand_mentions ?? 0;
      const competitorComparison = item.competitor_comparison
        ? JSON.stringify(item.competitor_comparison)
        : null;

      await db
        .insert(semrushMetrics)
        .values({
          clientId,
          date,
          aiVisibilityScore,
          brandMentions,
          platform,
          competitorComparison,
        })
        .onConflictDoNothing(); // index is non-unique; skip exact duplicates

      rowsInserted++;
    }

    // If no items returned, insert a single "overall" placeholder row with nulls
    if (items.length === 0) {
      await db
        .insert(semrushMetrics)
        .values({
          clientId,
          date,
          aiVisibilityScore: null,
          brandMentions: 0,
          platform: "overall",
          competitorComparison: null,
        })
        .onConflictDoNothing();
      rowsInserted = 1;
    }

    // 7. Update aiVisibility aggregate (combines Rankscale + SEMrush scores)
    await updateAiVisibilityAggregate(clientId, date);

    // 8. Update lastSyncedAt
    await db
      .update(dataSources)
      .set({ lastSyncedAt: new Date(), lastSyncError: null })
      .where(eq(dataSources.id, dataSource.id));

    return { success: true, rowsInserted, source };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown SEMrush sync error";

    await db
      .update(dataSources)
      .set({ lastSyncError: errorMsg })
      .where(eq(dataSources.id, dataSource.id));

    return { success: false, rowsInserted: 0, error: errorMsg, source };
  }
}


