"use client";

import { useState, useRef } from "react";
import { KeywordFormDialog } from "./keyword-form-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Upload } from "lucide-react";

interface Keyword {
  id: string;
  keyword: string;
  monthlyVolume: number | null;
  difficulty: number | null;
  intent: "INFORMATIONAL" | "NAVIGATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | null;
  priority: "HIGH" | "MEDIUM" | "LOW" | null;
  currentPosition: number | null;
  targetPosition: number | null;
  targetUrl: string | null;
  notes: string | null;
  status: "OPPORTUNITY" | "TARGETING" | "RANKING" | "WON" | null;
}

interface AdminKeywordTableProps {
  keywords: Keyword[];
  clientId: string;
}

function getDifficultyColor(d: number): string {
  if (d <= 30) return "bg-green-500";
  if (d <= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function StatusBadge({ status }: { status: Keyword["status"] }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    OPPORTUNITY: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    TARGETING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    RANKING: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    WON: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/["\s]/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

export function AdminKeywordTable({ keywords: initialKeywords, clientId }: AdminKeywordTableProps) {
  const [keywords, setKeywords] = useState(initialKeywords);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const res = await fetch(`/api/keywords?clientId=${clientId}`);
    if (res.ok) {
      const data = await res.json() as Keyword[];
      setKeywords(data);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this keyword?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/keywords/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeywords((prev) => prev.filter((k) => k.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        setImportError("No data found in CSV. Ensure the file has headers and at least one row.");
        return;
      }

      const mapped = rows
        .filter((r) => r.keyword || r.keyword0)
        .map((r) => ({
          keyword: r.keyword || r.keyword0 || "",
          monthlyVolume: r.monthlyvolume || r.volume || r.monthlysearchvolume ? parseInt(r.monthlyvolume || r.volume || r.monthlysearchvolume, 10) : null,
          difficulty: r.difficulty || r.kd ? parseInt(r.difficulty || r.kd, 10) : null,
          intent: (r.intent?.toUpperCase() as Keyword["intent"]) || null,
          priority: (r.priority?.toUpperCase() as "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
          currentPosition: r.currentposition || r.position ? parseInt(r.currentposition || r.position, 10) : null,
          targetPosition: r.targetposition ? parseInt(r.targetposition, 10) : null,
          targetUrl: r.targeturl || r.url || null,
          notes: r.notes || null,
          status: (r.status?.toUpperCase() as Keyword["status"]) || "OPPORTUNITY",
        }));

      const res = await fetch("/api/keywords/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, rows: mapped }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Import failed");
      }

      const json = await res.json() as { inserted: number };
      alert(`Successfully imported ${json.inserted} keywords.`);
      await reload();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {keywords.length} {keywords.length === 1 ? "keyword" : "keywords"}
        </p>
        <div className="flex items-center gap-2">
          {importError && (
            <p className="text-xs text-destructive">{importError}</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVImport}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? "Importing..." : "Import CSV"}
          </Button>
          <KeywordFormDialog clientId={clientId} onSuccess={reload} />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {keywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <p className="text-sm font-medium">No keywords yet</p>
              <p className="text-xs text-muted-foreground">
                Add keywords manually or import from a CSV file.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Keyword</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Volume</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Difficulty</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Intent</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Priority</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Position</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Status</th>
                    <th className="h-10 px-3 text-right align-middle font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => (
                    <tr key={kw.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium max-w-xs">
                        <span className="truncate block">{kw.keyword}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                        {kw.monthlyVolume?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {kw.difficulty !== null ? (
                          <div className="flex items-center gap-2 min-w-20">
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getDifficultyColor(kw.difficulty)}`}
                                style={{ width: `${kw.difficulty}%` }}
                              />
                            </div>
                            <span className="text-xs w-5 text-right text-muted-foreground">{kw.difficulty}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{kw.intent ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{kw.priority ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {kw.currentPosition !== null ? `#${kw.currentPosition}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={kw.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <KeywordFormDialog
                            clientId={clientId}
                            editKeyword={kw}
                            onSuccess={reload}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deleting === kw.id}
                            onClick={() => handleDelete(kw.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
