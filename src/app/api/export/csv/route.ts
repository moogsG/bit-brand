import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  clients,
  clientUsers,
  keywordResearch,
  ga4Metrics,
  gscMetrics,
} from "@/lib/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { keywordsToCSV, metricsToCSV } from "@/lib/export/csv";

// GET /api/export/csv?type=keywords&clientId={id}
// GET /api/export/csv?type=gsc&clientId={id}&month={m}&year={y}
// GET /api/export/csv?type=ga4&clientId={id}&month={m}&year={y}
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const clientId = searchParams.get("clientId");

  if (!clientId || !type) {
    return NextResponse.json({ error: "Missing type or clientId" }, { status: 400 });
  }

  // Verify client exists
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .get();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Access control: admin OR the client's own user
  if (session.user.role !== "ADMIN") {
    const cu = await db
      .select()
      .from(clientUsers)
      .where(
        and(
          eq(clientUsers.clientId, clientId),
          eq(clientUsers.userId, session.user.id)
        )
      )
      .get();
    if (!cu) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let csvContent = "";
  let filename = "export.csv";
  const today = new Date().toISOString().split("T")[0];

  if (type === "keywords") {
    const keywords = await db
      .select()
      .from(keywordResearch)
      .where(eq(keywordResearch.clientId, clientId))
      .orderBy(keywordResearch.keyword)
      .all();

    csvContent = keywordsToCSV(
      keywords.map((kw) => ({
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
      }))
    );
    filename = `keywords_${client.slug}_${today}.csv`;
  } else if (type === "ga4") {
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    let whereClause = eq(ga4Metrics.clientId, clientId);

    if (monthParam && yearParam) {
      const monthNum = parseInt(monthParam, 10);
      const yearNum = parseInt(yearParam, 10);
      const start = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
      const end = new Date(yearNum, monthNum, 0).toISOString().split("T")[0];
      whereClause = and(
        eq(ga4Metrics.clientId, clientId),
        gte(ga4Metrics.date, start),
        lte(ga4Metrics.date, end)
      ) as typeof whereClause;
    }

    const rows = await db
      .select()
      .from(ga4Metrics)
      .where(whereClause)
      .orderBy(ga4Metrics.date)
      .all();

    csvContent = metricsToCSV(
      rows.map((r) => ({
        date: r.date,
        sessions: r.sessions,
        users: r.users,
        newUsers: r.newUsers,
        pageviews: r.pageviews,
        bounceRate: r.bounceRate,
        avgSessionDuration: r.avgSessionDuration,
        organicSessions: r.organicSessions,
      }))
    );
    filename = `ga4_${client.slug}_${today}.csv`;
  } else if (type === "gsc") {
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    let whereClause = eq(gscMetrics.clientId, clientId);

    if (monthParam && yearParam) {
      const monthNum = parseInt(monthParam, 10);
      const yearNum = parseInt(yearParam, 10);
      const start = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
      const end = new Date(yearNum, monthNum, 0).toISOString().split("T")[0];
      whereClause = and(
        eq(gscMetrics.clientId, clientId),
        gte(gscMetrics.date, start),
        lte(gscMetrics.date, end)
      ) as typeof whereClause;
    }

    const rows = await db
      .select()
      .from(gscMetrics)
      .where(whereClause)
      .orderBy(gscMetrics.date)
      .all();

    csvContent = metricsToCSV(
      rows.map((r) => ({
        date: r.date,
        query: r.query,
        page: r.page,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }))
    );
    filename = `gsc_${client.slug}_${today}.csv`;
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  return new NextResponse("\ufeff" + csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
