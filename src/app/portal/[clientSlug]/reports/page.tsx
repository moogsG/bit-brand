import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, monthlyReports } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ArrowRight, Calendar } from "lucide-react";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function ReportsPage({
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

  const reports = await db
    .select()
    .from(monthlyReports)
    .where(
      and(
        eq(monthlyReports.clientId, client.id),
        eq(monthlyReports.status, "PUBLISHED")
      )
    )
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month))
    .all();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Monthly Reports</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Monthly SEO performance reports from your account team.
          </p>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">No reports published yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Monthly reports will appear here once they are published by your account manager.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/portal/${clientSlug}/reports/${report.id}`}
              className="block group"
            >
              <Card className="transition-all hover:shadow-md hover:border-primary/40 group-hover:bg-muted/20">
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {MONTH_NAMES[report.month]} {report.year}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{report.title}</p>
                      {report.publishedAt && (
                        <p className="text-xs text-muted-foreground">
                          Published{" "}
                          {new Date(report.publishedAt).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
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
