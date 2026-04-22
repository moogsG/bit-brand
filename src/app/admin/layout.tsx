import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { can } from "@/lib/auth/authorize";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!can("admin", "view", { session })) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar
        userName={session.user.name ?? "Admin"}
        userEmail={session.user.email ?? ""}
        userRole={session.user.role}
        userRawRole={session.user.rawRole}
      />
      {/* Main content — offset by sidebar width */}
      <div className="flex flex-1 flex-col overflow-hidden pl-60">
        {children}
      </div>
    </div>
  );
}
