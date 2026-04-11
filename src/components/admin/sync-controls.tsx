"use client";

import { useState } from "react";
import type { DataSource } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncResult {
  success: boolean;
  rowsInserted: number;
  error?: string;
  source: string;
}

type SyncStatus = "idle" | "loading" | "success" | "error";

interface SourceState {
  status: SyncStatus;
  result?: SyncResult;
}

type DataSourceType = "GA4" | "GSC" | "AHREFS" | "RANKSCALE" | "SEMRUSH";

const SOURCE_LABELS: Record<DataSourceType, string> = {
  GA4: "Google Analytics 4",
  GSC: "Google Search Console",
  AHREFS: "Ahrefs",
  RANKSCALE: "RankScale",
  SEMRUSH: "SEMrush",
};

// ─── Time Formatting ──────────────────────────────────────────────────────────

function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "Never synced";
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

// ─── Single Source Row ────────────────────────────────────────────────────────

interface SourceRowProps {
  clientId: string;
  source: DataSource;
  state: SourceState;
  onSync: (sourceType: DataSourceType) => void;
}

function SourceRow({ clientId: _clientId, source, state, onSync }: SourceRowProps) {
  const sourceType = source.type as DataSourceType;
  const label = SOURCE_LABELS[sourceType] ?? source.type;
  const isLoading = state.status === "loading";

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        {/* Connection status indicator */}
        {source.isConnected ? (
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(source.lastSyncedAt)}
            </p>
          </div>

          {/* Sync result feedback */}
          {state.status === "success" && state.result && (
            <p className="text-xs text-green-600 mt-0.5">
              Synced — {state.result.rowsInserted} row{state.result.rowsInserted === 1 ? "" : "s"} inserted
            </p>
          )}
          {state.status === "error" && state.result && (
            <p className="text-xs text-destructive mt-0.5 truncate max-w-xs">
              {state.result.error ?? "Sync failed"}
            </p>
          )}
          {source.lastSyncError && state.status === "idle" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 truncate max-w-xs">
              Last error: {source.lastSyncError}
            </p>
          )}
        </div>
      </div>

      <Button
        size="sm"
        variant={source.isConnected ? "outline" : "ghost"}
        disabled={!source.isConnected || isLoading}
        onClick={() => onSync(sourceType)}
        className="shrink-0 ml-3"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
        />
        {isLoading ? "Syncing…" : "Sync Now"}
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SyncControlsProps {
  clientId: string;
  dataSources: DataSource[];
}

export function SyncControls({ clientId, dataSources }: SyncControlsProps) {
  const [sourceStates, setSourceStates] = useState<
    Record<string, SourceState>
  >(() =>
    Object.fromEntries(dataSources.map((s) => [s.type, { status: "idle" }]))
  );
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<string | null>(null);

  const connectedSources = dataSources.filter((s) => s.isConnected);

  // ─── Sync single source ───────────────────────────────────────────────────

  const handleSyncSource = async (sourceType: DataSourceType) => {
    setSourceStates((prev) => ({
      ...prev,
      [sourceType]: { status: "loading" },
    }));

    try {
      const res = await fetch(`/api/sync/${clientId}/${sourceType}`, {
        method: "POST",
      });

      const result = (await res.json()) as SyncResult;

      setSourceStates((prev) => ({
        ...prev,
        [sourceType]: {
          status: result.success ? "success" : "error",
          result,
        },
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      setSourceStates((prev) => ({
        ...prev,
        [sourceType]: {
          status: "error",
          result: {
            success: false,
            rowsInserted: 0,
            error: errorMsg,
            source: sourceType,
          },
        },
      }));
    }
  };

  // ─── Sync all connected sources ──────────────────────────────────────────

  const handleSyncAll = async () => {
    if (connectedSources.length === 0) return;

    setIsSyncingAll(true);
    setSyncAllResult(null);

    // Set all connected sources to loading
    setSourceStates((prev) => {
      const next = { ...prev };
      for (const s of connectedSources) {
        next[s.type] = { status: "loading" };
      }
      return next;
    });

    try {
      const res = await fetch(`/api/sync/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = (await res.json()) as { results: SyncResult[] };
      const results = json.results ?? [];

      // Update each source state based on results
      setSourceStates((prev) => {
        const next = { ...prev };
        for (const result of results) {
          next[result.source] = {
            status: result.success ? "success" : "error",
            result,
          };
        }
        return next;
      });

      const successCount = results.filter((r) => r.success).length;
      const totalCount = results.length;
      setSyncAllResult(
        `${successCount}/${totalCount} sources synced successfully`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      setSyncAllResult(`Sync failed: ${errorMsg}`);

      setSourceStates((prev) => {
        const next = { ...prev };
        for (const s of connectedSources) {
          if (next[s.type]?.status === "loading") {
            next[s.type] = {
              status: "error",
              result: {
                success: false,
                rowsInserted: 0,
                error: errorMsg,
                source: s.type,
              },
            };
          }
        }
        return next;
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (dataSources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No data sources configured. Add data sources in the Data Sources tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Data Sync</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {connectedSources.length} of {dataSources.length} source
              {dataSources.length === 1 ? "" : "s"} connected
            </p>
          </div>
          <Button
            size="sm"
            disabled={connectedSources.length === 0 || isSyncingAll}
            onClick={handleSyncAll}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncingAll ? "animate-spin" : ""}`}
            />
            {isSyncingAll ? "Syncing All…" : "Sync All"}
          </Button>
        </div>
        {syncAllResult && (
          <p className="text-xs text-muted-foreground mt-1">{syncAllResult}</p>
        )}
      </CardHeader>

      <CardContent className="p-0 px-6 pb-2">
        {dataSources.map((source) => (
          <SourceRow
            key={source.id}
            clientId={clientId}
            source={source}
            state={sourceStates[source.type] ?? { status: "idle" }}
            onSync={handleSyncSource}
          />
        ))}
      </CardContent>
    </Card>
  );
}
