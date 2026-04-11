"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface PromptResult {
  id: string;
  prompt: string;
  platform: string;
  isVisible: boolean;
  position: number | null;
  visibilityScore: number | null;
  date: string;
}

interface PromptResultsTableProps {
  prompts: PromptResult[];
}

const PLATFORMS = ["All", "ChatGPT", "Perplexity", "Gemini", "Other"];

function getPlatformGroup(platform: string): string {
  const known = ["ChatGPT", "Perplexity", "Gemini"];
  if (known.includes(platform)) return platform;
  return "Other";
}

function VisibleBadge({ visible }: { visible: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        visible
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      {visible ? "Visible" : "Not visible"}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function PromptResultsTable({ prompts }: PromptResultsTableProps) {
  const [activeTab, setActiveTab] = useState("All");

  const filtered =
    activeTab === "All"
      ? prompts
      : prompts.filter((p) => getPlatformGroup(p.platform) === activeTab);

  // Sort by date descending
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {PLATFORMS.map((tab) => {
          const count =
            tab === "All"
              ? prompts.length
              : prompts.filter((p) => getPlatformGroup(p.platform) === tab).length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              {count > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No prompt results for{" "}
                {activeTab === "All" ? "any platform" : activeTab} yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Prompt</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Platform</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Visible</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Position</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Score</th>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-3 py-3 max-w-xs">
                        <span className="text-xs text-foreground/80 line-clamp-2">{p.prompt}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-foreground">
                          {p.platform}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <VisibleBadge visible={p.isVisible} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                        {p.position !== null ? `#${p.position}` : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {p.visibilityScore !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-500"
                                style={{ width: `${p.visibilityScore}%` }}
                              />
                            </div>
                            <span className="text-xs">{Math.round(p.visibilityScore)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground text-xs">
                        {formatDate(p.date)}
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
