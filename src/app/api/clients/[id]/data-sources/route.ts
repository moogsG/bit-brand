import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources, clients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const dataSourceTypes = ["GA4", "GSC", "AHREFS", "RANKSCALE", "SEMRUSH"] as const;

const upsertDataSourceSchema = z.object({
  type: z.enum(dataSourceTypes),
  // GA4
  propertyId: z.string().optional().nullable(),
  // GSC
  siteUrl: z.string().optional().nullable(),
  // API key sources (AHREFS, RANKSCALE, SEMRUSH)
  // TODO: Encrypt API keys before storing in production
  credentialsEnc: z.string().optional().nullable(),
  isConnected: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify client exists
  const client = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, id))
    .get();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const sources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.clientId, id));

  return NextResponse.json(sources);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = upsertDataSourceSchema.parse(body);

    // Verify client exists
    const client = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, id))
      .get();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if data source of this type already exists for client
    const existing = await db
      .select({ id: dataSources.id })
      .from(dataSources)
      .where(
        and(
          eq(dataSources.clientId, id),
          eq(dataSources.type, parsed.type)
        )
      )
      .get();

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(dataSources)
        .set({
          propertyId: parsed.propertyId ?? null,
          siteUrl: parsed.siteUrl ?? null,
          credentialsEnc: parsed.credentialsEnc ?? null,
          isConnected: parsed.isConnected ?? false,
          updatedAt: new Date(),
        })
        .where(eq(dataSources.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    // Insert new
    const [created] = await db
      .insert(dataSources)
      .values({
        clientId: id,
        type: parsed.type,
        propertyId: parsed.propertyId ?? null,
        siteUrl: parsed.siteUrl ?? null,
        credentialsEnc: parsed.credentialsEnc ?? null,
        isConnected: parsed.isConnected ?? false,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save data source";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
