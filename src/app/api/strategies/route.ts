import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seoStrategies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const STRATEGY_SECTIONS = [
  { id: "executive-summary", title: "Executive Summary", order: 1 },
  { id: "current-state", title: "Current State Analysis", order: 2 },
  { id: "target-keywords", title: "Target Keywords & Topics", order: 3 },
  { id: "on-page", title: "On-Page Optimisation Plan", order: 4 },
  { id: "content-strategy", title: "Content Strategy", order: 5 },
  { id: "link-building", title: "Link Building Strategy", order: 6 },
  { id: "technical-seo", title: "Technical SEO Recommendations", order: 7 },
  { id: "timeline", title: "Timeline & Milestones", order: 8 },
  { id: "kpis", title: "KPIs & Success Metrics", order: 9 },
];

const createStrategySchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
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

  // Clients can only see published strategies
  const rows = await db
    .select()
    .from(seoStrategies)
    .where(eq(seoStrategies.clientId, clientId))
    .orderBy(desc(seoStrategies.createdAt));

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
    const parsed = createStrategySchema.parse(body);

    const defaultSections = STRATEGY_SECTIONS.map((s) => ({
      ...s,
      content: "",
    }));

    const [row] = await db
      .insert(seoStrategies)
      .values({
        clientId: parsed.clientId,
        title: parsed.title,
        sections: JSON.stringify(defaultSections),
        status: "DRAFT",
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create strategy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
