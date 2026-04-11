"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Keyword {
  id: string;
  keyword: string;
  monthlyVolume: number | null;
  difficulty: number | null;
  intent: "INFORMATIONAL" | "NAVIGATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | null;
  priority: "HIGH" | "MEDIUM" | "LOW" | null;
  currentPosition: number | null;
  targetPosition: number | null;
  status: "OPPORTUNITY" | "TARGETING" | "RANKING" | "WON" | null;
  notes: string | null;
}

interface KeywordTableProps {
  keywords: Keyword[];
}

type SortKey = keyof Keyword;
type SortDir = "asc" | "desc";

function getDifficultyColor(d: number): string {
  if (d <= 30) return "bg-green-500";
  if (d <= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function getDifficultyLabel(d: number): string {
  if (d <= 30) return "Easy";
  if (d <= 60) return "Medium";
  return "Hard";
}

function getPositionColor(pos: number | null): string {
  if (pos === null) return "text-muted-foreground";
  if (pos <= 3) return "text-green-600 dark:text-green-400 font-semibold";
  if (pos <= 10) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

function IntentBadge({ intent }: { intent: Keyword["intent"] }) {
  if (!intent) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    INFORMATIONAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    NAVIGATIONAL: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    COMMERCIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    TRANSACTIONAL: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };
  const labels: Record<string, string> = {
    INFORMATIONAL: "Info",
    NAVIGATIONAL: "Nav",
    COMMERCIAL: "Commercial",
    TRANSACTIONAL: "Trans",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[intent]}`}>
      {labels[intent]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Keyword["priority"] }) {
  if (!priority) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    HIGH: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    LOW: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority]}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: Keyword["status"] }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    OPPORTUNITY: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    TARGETING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    RANKING: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    WON: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  const labels: Record<string, string> = {
    OPPORTUNITY: "Opportunity",
    TARGETING: "Targeting",
    RANKING: "Ranking",
    WON: "Won",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== column) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5" />
    : <ChevronDown className="h-3.5 w-3.5" />;
}

export function KeywordTable({ keywords }: KeywordTableProps) {
  const [search, setSearch] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let rows = keywords;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.keyword.toLowerCase().includes(q));
    }

    if (intentFilter !== "all") {
      rows = rows.filter((r) => r.intent === intentFilter);
    }

    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      rows = rows.filter((r) => r.priority === priorityFilter);
    }

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [keywords, search, intentFilter, statusFilter, priorityFilter, sortKey, sortDir]);

  const cols: { key: SortKey; label: string; sortable?: boolean }[] = [
    { key: "keyword", label: "Keyword", sortable: true },
    { key: "monthlyVolume", label: "Volume", sortable: true },
    { key: "difficulty", label: "Difficulty", sortable: true },
    { key: "intent", label: "Intent" },
    { key: "priority", label: "Priority", sortable: true },
    { key: "currentPosition", label: "Position", sortable: true },
    { key: "targetPosition", label: "Target", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={intentFilter}
          onChange={(e) => setIntentFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:border-ring"
        >
          <option value="all">All Intents</option>
          <option value="INFORMATIONAL">Informational</option>
          <option value="NAVIGATIONAL">Navigational</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="TRANSACTIONAL">Transactional</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:border-ring"
        >
          <option value="all">All Statuses</option>
          <option value="OPPORTUNITY">Opportunity</option>
          <option value="TARGETING">Targeting</option>
          <option value="RANKING">Ranking</option>
          <option value="WON">Won</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:border-ring"
        >
          <option value="all">All Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {keywords.length === 0 ? "No keywords yet" : "No keywords match your filters"}
              </p>
              <p className="text-xs text-muted-foreground">
                {keywords.length === 0
                  ? "Keywords will appear here once they are added by your account manager."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {cols.map((col) => (
                      <th
                        key={col.key}
                        className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {col.sortable ? (
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            {col.label}
                            <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((kw) => (
                    <tr
                      key={kw.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-3 font-medium max-w-xs">
                        <span className="truncate block">{kw.keyword}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {kw.monthlyVolume !== null
                          ? kw.monthlyVolume.toLocaleString()
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {kw.difficulty !== null ? (
                          <div className="flex items-center gap-2 min-w-24">
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getDifficultyColor(kw.difficulty)}`}
                                style={{ width: `${kw.difficulty}%` }}
                              />
                            </div>
                            <span className="text-xs w-6 text-right">{kw.difficulty}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <IntentBadge intent={kw.intent} />
                      </td>
                      <td className="px-3 py-3">
                        <PriorityBadge priority={kw.priority} />
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap ${getPositionColor(kw.currentPosition)}`}>
                        {kw.currentPosition !== null ? `#${kw.currentPosition}` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                        {kw.targetPosition !== null ? `#${kw.targetPosition}` : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={kw.status} />
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        {kw.notes ? (
                          <span className="text-muted-foreground text-xs truncate block">{kw.notes}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
