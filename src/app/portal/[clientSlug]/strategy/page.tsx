import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, seoStrategies } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Target, ArrowRight, FileText } from "lucide-react";

export default async function StrategyPage({
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

  const strategies = await db
    .select()
    .from(seoStrategies)
    .where(
      and(
        eq(seoStrategies.clientId, client.id),
        eq(seoStrategies.status, "PUBLISHED")
      )
    )
    .orderBy(desc(seoStrategies.publishedAt))
    .all();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SEO Strategy</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Your tailored SEO strategy and action plan.
          </p>
        </div>
      </div>

      {strategies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">No strategy published yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Your SEO strategy document will be published here by your account manager.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {strategies.map((strategy) => (
            <Link
              key={strategy.id}
              href={`/portal/${clientSlug}/strategy/${strategy.id}`}
              className="block group"
            >
              <Card className="transition-all hover:shadow-md hover:border-primary/40 group-hover:bg-muted/20">
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{strategy.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Published{" "}
                        {strategy.publishedAt
                          ? new Date(strategy.publishedAt).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
