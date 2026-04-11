import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keywordResearch } from "@/lib/db/schema";
import { z } from "zod";

const importRowSchema = z.object({
  keyword: z.string().min(1),
  monthlyVolume: z.union([z.number(), z.string().transform(s => s ? parseInt(s, 10) : null)]).optional().nullable(),
  difficulty: z.union([z.number(), z.string().transform(s => s ? parseInt(s, 10) : null)]).optional().nullable(),
  intent: z.enum(["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"]).optional().nullable(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  currentPosition: z.union([z.number(), z.string().transform(s => s ? parseInt(s, 10) : null)]).optional().nullable(),
  targetPosition: z.union([z.number(), z.string().transform(s => s ? parseInt(s, 10) : null)]).optional().nullable(),
  targetUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["OPPORTUNITY", "TARGETING", "RANKING", "WON"]).optional(),
});

const importSchema = z.object({
  clientId: z.string().min(1),
  rows: z.array(importRowSchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as unknown;
    const parsed = importSchema.parse(body);

    const values = parsed.rows.map((row) => ({
      clientId: parsed.clientId,
      keyword: row.keyword,
      monthlyVolume: typeof row.monthlyVolume === "number" ? row.monthlyVolume : null,
      difficulty: typeof row.difficulty === "number" ? Math.min(100, Math.max(0, row.difficulty)) : null,
      intent: row.intent ?? null,
      priority: row.priority ?? "MEDIUM" as const,
      currentPosition: typeof row.currentPosition === "number" ? row.currentPosition : null,
      targetPosition: typeof row.targetPosition === "number" ? row.targetPosition : null,
      targetUrl: row.targetUrl ?? null,
      notes: row.notes ?? null,
      tags: null,
      status: row.status ?? "OPPORTUNITY" as const,
      createdBy: session.user.id,
    }));

    const inserted = await db
      .insert(keywordResearch)
      .values(values)
      .returning({ id: keywordResearch.id });

    return NextResponse.json({ inserted: inserted.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import keywords";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
