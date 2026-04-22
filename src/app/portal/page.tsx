import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, clientUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { can } from "@/lib/auth/authorize";

export default async function PortalPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Agency roles: redirect to admin dashboard
  if (can("admin", "view", { session })) {
    redirect("/admin/dashboard");
  }

  // CLIENT: find their associated client via clientUsers table
  const clientUser = await db
    .select({ clientId: clientUsers.clientId })
    .from(clientUsers)
    .where(eq(clientUsers.userId, session.user.id))
    .get();

  if (!clientUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <h1 className="text-2xl font-bold">No client assigned</h1>
          <p className="text-muted-foreground text-sm">
            Your account hasn&apos;t been linked to a client portal yet. Please
            contact your account manager.
          </p>
        </div>
      </div>
    );
  }

  // Fetch the client slug
  const client = await db
    .select({ slug: clients.slug })
    .from(clients)
    .where(eq(clients.id, clientUser.clientId))
    .get();

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <h1 className="text-2xl font-bold">Client not found</h1>
          <p className="text-muted-foreground text-sm">
            The client associated with your account could not be found. Please
            contact support.
          </p>
        </div>
      </div>
    );
  }

  redirect(`/portal/${client.slug}/dashboard`);
}
