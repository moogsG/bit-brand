import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar
        userName={session.user.name ?? "Admin"}
        userEmail={session.user.email ?? ""}
      />
      {/* Main content — offset by sidebar width */}
      <div className="flex flex-1 flex-col overflow-hidden pl-60">
        {children}
      </div>
    </div>
  );
}
