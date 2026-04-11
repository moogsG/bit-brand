import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyReports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getReportAutoData } from "@/lib/reports/auto-data";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const report = await db
    .select()
    .from(monthlyReports)
    .where(eq(monthlyReports.id, id))
    .get();

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  try {
    const autoData = await getReportAutoData(
      report.clientId,
      report.month,
      report.year
    );

    return NextResponse.json({ autoData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
