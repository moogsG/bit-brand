import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { clients, users, invitations } from "@/lib/db/schema";
import { eq, count, desc, and, isNull } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/admin-header";
import { ClientStatusBadge } from "@/components/admin/client-status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Building2, Mail, Activity } from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Parallel data fetching
  const [
    totalClientsResult,
    activeClientsResult,
    pendingInvitesResult,
    totalPortalUsersResult,
    recentClients,
  ] = await Promise.all([
    db.select({ count: count() }).from(clients).get(),
    db.select({ count: count() }).from(clients).where(eq(clients.isActive, true)).get(),
    db
      .select({ count: count() })
      .from(invitations)
      .where(isNull(invitations.acceptedAt))
      .get(),
    db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "CLIENT"))
      .get(),
    db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt))
      .limit(5),
  ]);

  const stats = [
    {
      label: "Total Clients",
      value: totalClientsResult?.count ?? 0,
      icon: Building2,
      description: "All registered clients",
    },
    {
      label: "Active Clients",
      value: activeClientsResult?.count ?? 0,
      icon: Activity,
      description: "Currently active",
    },
    {
      label: "Pending Invitations",
      value: pendingInvitesResult?.count ?? 0,
      icon: Mail,
      description: "Awaiting acceptance",
    },
    {
      label: "Portal Users",
      value: totalPortalUsersResult?.count ?? 0,
      icon: Users,
      description: "Client role accounts",
    },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminHeader title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, description }) => (
            <Card key={label}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Clients */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Clients</CardTitle>
              <Link
                href="/admin/clients"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentClients.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm px-4">
                No clients yet.{" "}
                <Link href="/admin/clients" className="underline hover:text-foreground">
                  Add your first client.
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/admin/clients/${client.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.domain}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <ClientStatusBadge isActive={client.isActive} />
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {client.createdAt
                          ? new Date(client.createdAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
