import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clients, keywordResearch } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKeywordTable } from "@/components/admin/admin-keyword-table";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminKeywordsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;

  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .get();

  if (!client) notFound();

  const keywords = await db
    .select()
    .from(keywordResearch)
    .where(eq(keywordResearch.clientId, id))
    .orderBy(keywordResearch.keyword)
    .all();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminHeader title={`${client.name} — Keywords`} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-3">
          <Link
            href={`/admin/clients/${id}?tab=overview`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {client.name}
          </Link>
          <div>
            <h1 className="text-xl font-bold">Keyword Research</h1>
            <p className="text-sm text-muted-foreground">
              Manage keyword targets for {client.name}
            </p>
          </div>
        </div>

        <AdminKeywordTable
          keywords={keywords}
          clientId={id}
        />
      </main>
    </div>
  );
}
