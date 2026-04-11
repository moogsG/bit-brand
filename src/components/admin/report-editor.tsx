"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Globe, RefreshCw } from "lucide-react";
import type { ReportAutoData } from "@/lib/reports/auto-data";

interface ReportSections {
  executiveSummary?: { adminNotes?: string };
  wins?: { adminNotes?: string };
  opportunities?: { adminNotes?: string };
  nextMonthGoals?: { adminNotes?: string };
}

interface ReportEditorProps {
  reportId: string;
  clientId: string;
  monthLabel: string;
  initialSections: ReportSections;
  initialStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  autoData: ReportAutoData;
}

export function ReportEditor({
  reportId,
  monthLabel,
  initialSections,
  initialStatus,
  autoData: initialAutoData,
}: ReportEditorProps) {
  const [sections, setSections] = useState<ReportSections>(initialSections);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autoData, setAutoData] = useState(initialAutoData);

  const save = async (newStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, status: newStatus }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Save failed");
      }
      setStatus(newStatus);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      const json = await res.json() as { autoData: ReportAutoData };
      setAutoData(json.autoData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const setText = (key: keyof ReportSections, value: string) => {
    setSections((prev) => ({
      ...prev,
      [key]: { ...prev[key], adminNotes: value },
    }));
  };

  const hasGa4 = autoData.ga4.totalSessions > 0;
  const hasGsc = autoData.gsc.totalClicks > 0 || autoData.gsc.totalImpressions > 0;
  const hasAhrefs = autoData.ahrefs.domainRating !== null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            status === "PUBLISHED"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
          }`}>
            {status}
          </span>
          <p className="text-sm font-semibold">{monthLabel}</p>
          {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
          {saveSuccess && <span className="text-xs text-green-600">Saved!</span>}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={refresh}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => save("DRAFT")}>
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => save("PUBLISHED")}>
            <Globe className="h-3.5 w-3.5" />
            {status === "PUBLISHED" ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Auto-data preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Auto-pulled Data Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <p className="font-semibold">{hasGa4 ? autoData.ga4.totalSessions.toLocaleString() : "—"}</p>
              <p className="text-xs text-muted-foreground">Sessions (GA4)</p>
            </div>
            <div>
              <p className="font-semibold">{hasGsc ? autoData.gsc.totalClicks.toLocaleString() : "—"}</p>
              <p className="text-xs text-muted-foreground">Clicks (GSC)</p>
            </div>
            <div>
              <p className="font-semibold">{hasGsc ? autoData.gsc.avgPosition.toFixed(1) : "—"}</p>
              <p className="text-xs text-muted-foreground">Avg Position</p>
            </div>
            <div>
              <p className="font-semibold">
                {hasAhrefs
                  ? autoData.ahrefs.domainRating !== null
                    ? Math.round(autoData.ahrefs.domainRating)
                    : "—"
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Domain Rating</p>
            </div>
          </div>
          {!hasGa4 && !hasGsc && !hasAhrefs && (
            <p className="text-xs text-muted-foreground">
              No metrics data found for this month. Ensure data sources are synced.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Editable text sections */}
      {(
        [
          { key: "executiveSummary" as const, label: "Executive Summary" },
          { key: "wins" as const, label: "Wins This Month" },
          { key: "opportunities" as const, label: "Opportunities" },
          { key: "nextMonthGoals" as const, label: "Next Month Goals" },
        ] as const
      ).map(({ key, label }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`report-${key}`}>{label}</Label>
          <textarea
            id={`report-${key}`}
            rows={5}
            value={sections[key]?.adminNotes ?? ""}
            onChange={(e) => setText(key, e.target.value)}
            placeholder={`Write the ${label} content here...`}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring resize-y min-h-24"
          />
        </div>
      ))}

      {/* Bottom save */}
      <div className="flex items-center justify-end gap-2 pb-6">
        <Button type="button" variant="outline" disabled={saving} onClick={() => save("DRAFT")}>
          <Save className="h-4 w-4" />
          Save Draft
        </Button>
        <Button type="button" disabled={saving} onClick={() => save("PUBLISHED")}>
          <Globe className="h-4 w-4" />
          {status === "PUBLISHED" ? "Update Published" : "Publish Report"}
        </Button>
      </div>
    </div>
  );
}
