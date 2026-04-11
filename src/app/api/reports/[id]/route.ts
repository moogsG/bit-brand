import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyReports, clients, clientUsers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendReportPublishedEmail } from "@/lib/email";

const updateReportSchema = z.object({
  sections: z.record(z.string(), z.unknown()).optional(),
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
    .from(monthlyReports)
    .where(eq(monthlyReports.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN" && row.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json() as unknown;
    const parsed = updateReportSchema.parse(body);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (parsed.sections !== undefined) {
      updateData.sections = JSON.stringify(parsed.sections);
    }
    if (parsed.status !== undefined) {
      updateData.status = parsed.status;
      if (parsed.status === "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
    }

    const [updated] = await db
      .update(monthlyReports)
      .set(updateData)
      .where(eq(monthlyReports.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Send email notifications when publishing (fire-and-forget)
    if (parsed.status === "PUBLISHED" && updated) {
      const reportId2 = updated.id;
      const clientId2 = updated.clientId;
      const reportTitle2 = updated.title;
      const baseUrl =
        process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      void (async () => {
        try {
          const clientRecord = await db
            .select({ slug: clients.slug })
            .from(clients)
            .where(eq(clients.id, clientId2))
            .get();
          if (!clientRecord) return;
          const portalUrl = `${baseUrl}/portal/${clientRecord.slug}/reports/${reportId2}`;
          const cuRows = await db
            .select({ userId: clientUsers.userId })
            .from(clientUsers)
            .where(eq(clientUsers.clientId, clientId2))
            .all();
          for (const cu of cuRows) {
            const userRecord = await db
              .select({ email: users.email })
              .from(users)
              .where(eq(users.id, cu.userId))
              .get();
            if (userRecord?.email) {
              sendReportPublishedEmail({
                to: userRecord.email,
                reportTitle: reportTitle2,
                portalUrl,
              }).catch((err: unknown) => {
                console.error("Failed to send report email:", err);
              });
            }
          }
        } catch (err: unknown) {
          console.error("Failed to notify report published:", err);
        }
      })();
    }

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(monthlyReports)
    .where(eq(monthlyReports.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
