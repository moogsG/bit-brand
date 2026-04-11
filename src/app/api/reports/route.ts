import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyReports } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const createReportSchema = z.object({
  clientId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

const defaultSections = JSON.stringify({
  executiveSummary: { adminNotes: "" },
  wins: { adminNotes: "" },
  opportunities: { adminNotes: "" },
  nextMonthGoals: { adminNotes: "" },
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(monthlyReports)
    .where(eq(monthlyReports.clientId, clientId))
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month));

  const filtered = session.user.role === "ADMIN"
    ? rows
    : rows.filter((r) => r.status === "PUBLISHED");

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as unknown;
    const parsed = createReportSchema.parse(body);

    const title = `${MONTH_NAMES[parsed.month]} ${parsed.year} — SEO Report`;

    const [row] = await db
      .insert(monthlyReports)
      .values({
        clientId: parsed.clientId,
        month: parsed.month,
        year: parsed.year,
        title,
        sections: defaultSections,
        status: "DRAFT",
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create report";
    // Handle unique constraint (already exists)
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return NextResponse.json({ error: "A report for this month already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
