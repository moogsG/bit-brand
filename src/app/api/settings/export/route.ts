import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, clientUsers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all clients with their associated portal user emails (no credentials)
  const allClients = await db.select().from(clients);

  const clientsWithUsers = await Promise.all(
    allClients.map(async (client) => {
      const portalUsers = await db
        .select({ userId: clientUsers.userId, name: users.name, email: users.email })
        .from(clientUsers)
        .innerJoin(users, eq(clientUsers.userId, users.id))
        .where(eq(clientUsers.clientId, client.id));

      return {
        id: client.id,
        name: client.name,
        domain: client.domain,
        slug: client.slug,
        industry: client.industry,
        isActive: client.isActive,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        // No sensitive credentials — only portal user info
        portalUsers: portalUsers.map((u) => ({ name: u.name, email: u.email })),
      };
    })
  );

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      totalClients: clientsWithUsers.length,
      clients: clientsWithUsers,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="bba-clients-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Content-Type": "application/json",
      },
    }
  );
}
