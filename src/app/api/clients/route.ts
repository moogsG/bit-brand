import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const row = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.slug, slug))
      .get();
    if (!row) return slug;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }
}

const createClientSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  industry: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allClients = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));

  return NextResponse.json(allClients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createClientSchema.parse(body);

    const baseSlug = generateSlug(parsed.name);
    const slug = await ensureUniqueSlug(baseSlug);

    const [client] = await db
      .insert(clients)
      .values({
        name: parsed.name,
        domain: parsed.domain,
        slug,
        industry: parsed.industry ?? null,
        notes: parsed.notes ?? null,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create client";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
