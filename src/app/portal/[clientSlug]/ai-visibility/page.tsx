import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, aiVisibility, rankscaleMetrics } from "@/lib/db/schema";
import { and, eq, gte, desc } from "drizzle-orm";
import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiVisibilityTrendChart } from "@/components/portal/ai-visibility-trend-chart";
import { PromptResultsTable } from "@/components/portal/prompt-results-table";

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function ScoreDisplay({ score, label }: { score: number | null; label: string }) {
  const value = score !== null ? Math.round(score) : null;
  const color =
    value === null
      ? "text-muted-foreground"
      : value >= 70
      ? "text-green-600 dark:text-green-400"
      : value >= 40
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="text-center space-y-1">
      <p className={`text-3xl font-bold ${color}`}>{value !== null ? value : "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function AiVisibilityPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { clientSlug } = await params;

  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.slug, clientSlug), eq(clients.isActive, true)))
    .get();

  if (!client) notFound();

  // Last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const startDate = toDateStr(twelveMonthsAgo);

  const [aiVisRows, promptRows] = await Promise.all([
    db
      .select()
      .from(aiVisibility)
      .where(
        and(
          eq(aiVisibility.clientId, client.id),
          gte(aiVisibility.date, startDate)
        )
      )
      .orderBy(aiVisibility.date)
      .all(),

    db
      .select()
      .from(rankscaleMetrics)
      .where(
        and(
          eq(rankscaleMetrics.clientId, client.id),
          gte(rankscaleMetrics.date, startDate)
        )
      )
      .orderBy(desc(rankscaleMetrics.date))
      .all(),
  ]);

  // Latest record for score overview
  const latest = aiVisRows.length > 0 ? aiVisRows[aiVisRows.length - 1] : null;
  const previous = aiVisRows.length > 1 ? aiVisRows[aiVisRows.length - 2] : null;

  const scoreTrend =
    latest?.overallScore !== null &&
    latest?.overallScore !== undefined &&
    previous?.overallScore !== null &&
    previous?.overallScore !== undefined
      ? latest.overallScore - previous.overallScore
      : null;

  const noData = aiVisRows.length === 0 && promptRows.length === 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-500" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Search Visibility</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track how your brand appears across AI-powered search platforms.
          </p>
        </div>
      </div>

      {noData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">No data yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              AI visibility tracking will appear here once data is synced from Rankscale and SEMrush.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score Overview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Overall Score */}
            <Card className="xl:col-span-1">
              <CardContent className="py-6 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className={`text-5xl font-black ${
                    latest?.overallScore !== null && latest?.overallScore !== undefined
                      ? latest.overallScore >= 70
                        ? "text-green-600 dark:text-green-400"
                        : latest.overallScore >= 40
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}>
                    {latest?.overallScore !== null && latest?.overallScore !== undefined
                      ? Math.round(latest.overallScore)
                      : "—"}
                  </p>
                  {scoreTrend !== null && (
                    <div className={`flex items-center text-sm font-medium ${
                      scoreTrend > 0
                        ? "text-green-600"
                        : scoreTrend < 0
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}>
                      {scoreTrend > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : scoreTrend < 0 ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      <span className="ml-0.5">{Math.abs(Math.round(scoreTrend))}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-center">Overall AI Score</p>
                <p className="text-xs text-muted-foreground text-center">out of 100</p>
              </CardContent>
            </Card>

            {/* Rankscale Score */}
            <Card>
              <CardContent className="py-6 flex flex-col items-center gap-1">
                <ScoreDisplay
                  score={latest?.rankscaleScore ?? null}
                  label="Rankscale Score"
                />
              </CardContent>
            </Card>

            {/* SEMrush Score */}
            <Card>
              <CardContent className="py-6 flex flex-col items-center gap-1">
                <ScoreDisplay
                  score={latest?.semrushScore ?? null}
                  label="SEMrush AI Score"
                />
              </CardContent>
            </Card>

            {/* Prompts Visible */}
            <Card>
              <CardContent className="py-6 flex flex-col items-center gap-1">
                <div className="text-center space-y-1">
                  <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {latest?.promptsVisible ?? 0}
                    <span className="text-lg text-muted-foreground font-normal">
                      /{latest?.totalPromptsTested ?? 0}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Prompts Visible</p>
                  {latest?.totalPromptsTested && latest.totalPromptsTested > 0 && (
                    <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                      {Math.round(((latest.promptsVisible ?? 0) / latest.totalPromptsTested) * 100)}% visibility rate
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          {aiVisRows.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Visibility Trend (Last 12 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                <AiVisibilityTrendChart
                  data={aiVisRows.map((r) => ({
                    date: r.date,
                    overallScore: r.overallScore,
                  }))}
                />
              </CardContent>
            </Card>
          )}

          {/* Prompt Results */}
          {promptRows.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">Prompt Results</h3>
                <p className="text-sm text-muted-foreground">
                  All tested prompts across AI platforms — last 12 months
                </p>
              </div>
              <PromptResultsTable
                prompts={promptRows.map((r) => ({
                  id: r.id,
                  prompt: r.prompt,
                  platform: r.platform,
                  isVisible: r.isVisible,
                  position: r.position,
                  visibilityScore: r.visibilityScore,
                  date: r.date,
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
