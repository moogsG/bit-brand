import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, seoStrategies } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Section {
  id: string;
  title: string;
  content: string;
  order: number;
}

export default async function StrategyDetailPage({
  params,
}: {
  params: Promise<{ clientSlug: string; strategyId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { clientSlug, strategyId } = await params;

  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.slug, clientSlug), eq(clients.isActive, true)))
    .get();

  if (!client) notFound();

  const strategy = await db
    .select()
    .from(seoStrategies)
    .where(
      and(
        eq(seoStrategies.id, strategyId),
        eq(seoStrategies.clientId, client.id)
      )
    )
    .get();

  if (!strategy) notFound();

  // Clients can only view published strategies
  if (session.user.role !== "ADMIN" && strategy.status !== "PUBLISHED") {
    notFound();
  }

  let sections: Section[] = [];
  try {
    const parsed = JSON.parse(strategy.sections) as unknown;
    if (Array.isArray(parsed)) {
      sections = parsed as Section[];
    }
  } catch {
    sections = [];
  }

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const publishedSections = sortedSections.filter((s) => s.content && s.content.trim().length > 0);

  return (
    <div className="max-w-3xl space-y-8">
      {/* Back link */}
      <Link
        href={`/portal/${clientSlug}/strategy`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Strategies
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SEO Strategy</p>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{strategy.title}</h1>
        {strategy.publishedAt && (
          <p className="text-sm text-muted-foreground">
            Published{" "}
            {new Date(strategy.publishedAt).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Sections */}
      {publishedSections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              This strategy document is being prepared. Check back soon.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {publishedSections.map((section) => (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-foreground/90 whitespace-pre-wrap"
                >
                  {section.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
