import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clients, monthlyReports } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/admin-header";
import { NorthStarRibbon } from "@/components/shared/north-star-ribbon";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReportEditor } from "@/components/admin/report-editor";
import { getReportAutoData } from "@/lib/reports/auto-data";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function AdminReportEditorPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id, reportId } = await params;

  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .get();

  if (!client) notFound();

  const report = await db
    .select()
    .from(monthlyReports)
    .where(
      and(
        eq(monthlyReports.id, reportId),
        eq(monthlyReports.clientId, id)
      )
    )
    .get();

  if (!report) notFound();

  let sections: Record<string, { adminNotes?: string }> = {};
  try {
    const parsed = JSON.parse(report.sections) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      sections = parsed as typeof sections;
    }
  } catch {
    sections = {};
  }

  // Pre-fetch auto data for preview
  const autoData = await getReportAutoData(client.id, report.month, report.year);

  const monthLabel = `${MONTH_NAMES[report.month]} ${report.year}`;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminHeader title={`${monthLabel} Report — ${client.name}`} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <Link
          href={`/admin/clients/${id}/reports`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Reports
        </Link>

        <NorthStarRibbon clientId={id} onboardingHref={`/admin/clients/${id}/onboarding`} />

        <ReportEditor
          reportId={reportId}
          clientId={id}
          monthLabel={monthLabel}
          initialSections={sections}
          initialStatus={report.status ?? "DRAFT"}
          autoData={autoData}
        />
      </main>
    </div>
  );
}
