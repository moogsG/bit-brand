import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, clientUsers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalHeader } from "@/components/portal/portal-header";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";

export default async function PortalClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { clientSlug } = await params;

  // Verify the client slug exists and is active
  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.slug, clientSlug), eq(clients.isActive, true)))
    .get();

  if (!client) {
    redirect("/portal");
  }

  // Role-based access control
  if (session.user.role === "ADMIN") {
    // ADMIN role: full access to any client portal (impersonation)
    // No additional check needed
  } else if (session.user.role === "CLIENT") {
    // CLIENT users must belong to this specific client
    const membership = await db
      .select()
      .from(clientUsers)
      .where(
        and(
          eq(clientUsers.clientId, client.id),
          eq(clientUsers.userId, session.user.id)
        )
      )
      .get();

    if (!membership) {
      redirect("/portal");
    }
  } else {
    redirect("/portal");
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Impersonation banner — full width, sticky top, only visible when ?impersonate=true */}
      <ImpersonationBanner clientName={client.name} clientId={client.id} />

      <div className="flex flex-1 overflow-hidden">
        {/* Fixed sidebar — 256px (w-64) */}
        <PortalSidebar
          clientName={client.name}
          clientDomain={client.domain}
          clientSlug={clientSlug}
          userName={session.user.name ?? "User"}
          userEmail={session.user.email ?? ""}
        />

        {/* Main content — offset by sidebar width */}
        <div className="flex flex-1 flex-col overflow-hidden pl-64">
          <PortalHeader
            userName={session.user.name ?? "User"}
            userEmail={session.user.email ?? ""}
          />
          <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
