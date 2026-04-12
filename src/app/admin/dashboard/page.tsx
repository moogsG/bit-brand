import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
	clients,
	users,
	invitations,
	approvals,
	tasks,
	clientMessages,
} from "@/lib/db/schema";
import { eq, count, desc, and, isNull, or } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/admin-header";
import { PendingApprovalsCard } from "@/components/admin/pending-approvals-card";
import { MyTasksCard } from "@/components/admin/my-tasks-card";
import { ClientHealthCard } from "@/components/admin/client-health-card";
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
    pendingApprovals,
    myTasks,
  ] = await Promise.all([
    db.select({ count: count() }).from(clients).get(),
    db
      .select({ count: count() })
      .from(clients)
      .where(eq(clients.isActive, true))
      .get(),
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
    db.select().from(clients).orderBy(desc(clients.createdAt)).limit(8),
    db
      .select()
      .from(approvals)
      .where(eq(approvals.status, "PENDING"))
      .orderBy(desc(approvals.createdAt))
      .limit(10)
      .all(),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.assignedTo, session.user.id))
      .orderBy(desc(tasks.createdAt))
      .limit(10)
      .all(),
  ]);

  // Fetch health metrics for recent clients
  const clientIds = recentClients.map((c) => c.id);
  const clientHealthData = await Promise.all(
    clientIds.map(async (clientId) => {
      const pendingRow = await db
        .select({ count: count() })
        .from(approvals)
        .where(
          and(eq(approvals.clientId, clientId), eq(approvals.status, "PENDING")),
        )
        .get();

      const criticalRow = await db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.clientId, clientId),
            or(eq(tasks.status, "BLOCKED"), eq(tasks.priority, "URGENT")),
          ),
        )
        .get();

      const unreadRow = await db
        .select({ count: count() })
        .from(clientMessages)
        .where(
          and(
            eq(clientMessages.clientId, clientId),
            eq(clientMessages.senderRole, "CLIENT"),
            isNull(clientMessages.readAt),
          ),
        )
        .get();

      const pendingApprovalsCount = pendingRow?.count ?? 0;
      const criticalTasksCount = criticalRow?.count ?? 0;
      const unreadMessagesCount = unreadRow?.count ?? 0;

      return {
        clientId,
        pendingApprovals: pendingApprovalsCount,
        criticalTasks: criticalTasksCount,
        unreadMessages: unreadMessagesCount,
      };
    })
  );

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

        {/* Approvals & Tasks Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PendingApprovalsCard approvals={pendingApprovals} />
          <MyTasksCard tasks={myTasks} userId={session.user.id} />
        </div>

        {/* Client Health Cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Clients</CardTitle>
              <Link
                href="/admin/clients"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No clients yet.{" "}
                <Link
                  href="/admin/clients"
                  className="underline hover:text-foreground"
                >
                  Add your first client.
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recentClients.map((client) => {
                  const healthData = clientHealthData.find(
                    (h) => h.clientId === client.id
                  );
                  return (
                    <ClientHealthCard
                      key={client.id}
                      client={client}
                      counts={{
                        pendingApprovals: healthData?.pendingApprovals ?? 0,
                        criticalTasks: healthData?.criticalTasks ?? 0,
                        unreadMessages: healthData?.unreadMessages ?? 0,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
