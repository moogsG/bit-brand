import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clients, monthlyReports } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/admin-header";
import { NorthStarRibbon } from "@/components/shared/north-star-ribbon";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminReportActions } from "@/components/admin/admin-report-actions";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;

  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .get();

  if (!client) notFound();

  const reports = await db
    .select()
    .from(monthlyReports)
    .where(eq(monthlyReports.clientId, id))
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month))
    .all();

  const statusColors: Record<string, string> = {
    DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    PUBLISHED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    ARCHIVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminHeader title={`${client.name} — Monthly Reports`} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-3">
          <Link
            href={`/admin/clients/${id}?tab=overview`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {client.name}
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Monthly Reports</h1>
              <p className="text-sm text-muted-foreground">
                Manage SEO reports for {client.name}
              </p>
            </div>
            <AdminReportActions clientId={id} />
          </div>
        </div>

        <NorthStarRibbon clientId={id} onboardingHref={`/admin/clients/${id}/onboarding`} />

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">No reports yet</p>
              <p className="text-xs text-muted-foreground">
                Create a new monthly report to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {MONTH_NAMES[r.month]} {r.year}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status ?? "DRAFT"]}`}>
                    {r.status ?? "DRAFT"}
                  </span>
                  <Link
                    href={`/admin/clients/${id}/reports/${r.id}`}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
