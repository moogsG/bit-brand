"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Settings, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { themeConfig } from "@/lib/theme.config";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/authorize";
import type { PermissionModule } from "@/lib/auth/permissions";

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: PermissionModule;
}[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    module: "admin",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    module: "settings",
  },
  {
    href: "/admin/ai-visibility",
    label: "AI Visibility",
    icon: Sparkles,
    module: "aiVisibility",
  },
];

interface AdminSidebarProps {
  userName: string;
  userEmail: string;
  userRole: string;
  userRawRole?: string;
}

export function AdminSidebar({
  userName,
  userEmail,
  userRole,
  userRawRole,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) =>
    can(item.module, "view", { role: userRole, rawRole: userRawRole }),
  );

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground fixed left-0 top-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
          {themeConfig.brand.shortName}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {themeConfig.brand.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {themeConfig.brand.tagline}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/admin/dashboard"
              ? pathname === "/admin/dashboard" || pathname === "/admin"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-border px-3 py-3 space-y-2">
        <div className="px-3 py-1">
          <p className="text-sm font-medium truncate">{userName}</p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
