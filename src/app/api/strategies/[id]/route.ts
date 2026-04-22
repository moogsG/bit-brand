import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seoStrategies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";

const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number(),
});

const updateStrategySchema = z.object({
  title: z.string().min(1).optional(),
  sections: z.array(sectionSchema).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const row = await db
    .select()
    .from(seoStrategies)
    .where(eq(seoStrategies.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const accessContext = await getClientAccessContext(session, row.clientId);

  if (!can("strategies", "view", { session, clientId: row.clientId, ...accessContext })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clients can only view published strategies
  if (
    !can("strategies", "edit", {
      session,
      clientId: row.clientId,
      ...accessContext,
    }) && row.status !== "PUBLISHED"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json() as unknown;
    const parsed = updateStrategySchema.parse(body);

    const strategy = await db
      .select({ clientId: seoStrategies.clientId })
      .from(seoStrategies)
      .where(eq(seoStrategies.id, id))
      .get();

    if (!strategy) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    const accessContext = await getClientAccessContext(session, strategy.clientId);

    if (!can("strategies", "edit", { session, clientId: strategy.clientId, ...accessContext })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      parsed.status === "PUBLISHED" &&
      !can("strategies", "publish", { session, clientId: strategy.clientId, ...accessContext })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (parsed.title !== undefined) updateData.title = parsed.title;
    if (parsed.sections !== undefined) updateData.sections = JSON.stringify(parsed.sections);
    if (parsed.status !== undefined) {
      updateData.status = parsed.status;
      if (parsed.status === "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
    }

    const [updated] = await db
      .update(seoStrategies)
      .set(updateData)
      .where(eq(seoStrategies.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update strategy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const strategy = await db
    .select({ clientId: seoStrategies.clientId })
    .from(seoStrategies)
    .where(eq(seoStrategies.id, id))
    .get();

  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const accessContext = await getClientAccessContext(session, strategy.clientId);

  if (!can("strategies", "edit", { session, clientId: strategy.clientId, ...accessContext })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(seoStrategies)
    .where(eq(seoStrategies.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
