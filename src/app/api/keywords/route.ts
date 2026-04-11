import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keywordResearch, clients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createKeywordSchema = z.object({
  clientId: z.string().min(1),
  keyword: z.string().min(1),
  monthlyVolume: z.number().int().nonnegative().optional().nullable(),
  difficulty: z.number().int().min(0).max(100).optional().nullable(),
  intent: z.enum(["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"]).optional().nullable(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  currentPosition: z.number().int().nonnegative().optional().nullable(),
  targetPosition: z.number().int().nonnegative().optional().nullable(),
  targetUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["OPPORTUNITY", "TARGETING", "RANKING", "WON"]).optional(),
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

  // If client user, verify they belong to this client
  if (session.user.role === "CLIENT") {
    const client = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .get();
    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const rows = await db
    .select()
    .from(keywordResearch)
    .where(eq(keywordResearch.clientId, clientId))
    .orderBy(keywordResearch.keyword);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as unknown;
    const parsed = createKeywordSchema.parse(body);

    const [row] = await db
      .insert(keywordResearch)
      .values({
        clientId: parsed.clientId,
        keyword: parsed.keyword,
        monthlyVolume: parsed.monthlyVolume ?? null,
        difficulty: parsed.difficulty ?? null,
        intent: parsed.intent ?? null,
        priority: parsed.priority ?? "MEDIUM",
        currentPosition: parsed.currentPosition ?? null,
        targetPosition: parsed.targetPosition ?? null,
        targetUrl: parsed.targetUrl ?? null,
        notes: parsed.notes ?? null,
        tags: parsed.tags ? JSON.stringify(parsed.tags) : null,
        status: parsed.status ?? "OPPORTUNITY",
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create keyword";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
