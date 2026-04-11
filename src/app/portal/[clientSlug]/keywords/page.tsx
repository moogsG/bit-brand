import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, keywordResearch } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { KeywordTable } from "@/components/portal/keyword-table";
import { KeywordExportButtons } from "@/components/portal/export-buttons";
import { Search } from "lucide-react";

export default async function KeywordsPage({
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

  const keywords = await db
    .select()
    .from(keywordResearch)
    .where(eq(keywordResearch.clientId, client.id))
    .orderBy(keywordResearch.keyword)
    .all();

  // Summary stats
  const total = keywords.length;
  const high = keywords.filter((k) => k.priority === "HIGH").length;
  const ranking = keywords.filter((k) => k.status === "RANKING").length;
  const won = keywords.filter((k) => k.status === "WON").length;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Keyword Research</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage your target keyword opportunities.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{high}</p>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{ranking + won}</p>
              <p className="text-xs text-muted-foreground">Ranking / Won</p>
            </div>
          </div>
          <KeywordExportButtons
            clientId={client.id}
            clientName={client.name}
            keywords={keywords.map((kw) => ({
              keyword: kw.keyword,
              monthlyVolume: kw.monthlyVolume,
              difficulty: kw.difficulty,
              intent: kw.intent,
              priority: kw.priority,
              currentPosition: kw.currentPosition,
              targetPosition: kw.targetPosition,
              targetUrl: kw.targetUrl,
              status: kw.status,
              notes: kw.notes,
            }))}
          />
        </div>
      </div>

      <KeywordTable keywords={keywords} />
    </div>
  );
}
