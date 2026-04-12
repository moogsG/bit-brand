"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Search,
  Target,
  FileText,
  Sparkles,
  LogOut,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { themeConfig } from "@/lib/theme.config";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

interface PortalSidebarProps {
  clientName: string;
  clientDomain: string;
  clientSlug: string;
  userName: string;
  userEmail: string;
}

function PortalSidebarInner({
  clientName,
  clientDomain,
  clientSlug,
  userName,
  userEmail,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isImpersonating = searchParams.get("impersonate") === "true";
  const impersonateParam = isImpersonating ? "?impersonate=true" : "";

  const base = `/portal/${clientSlug}`;

  const navItems = [
    {
      href: `${base}/dashboard${impersonateParam}`,
      matchHref: `${base}/dashboard`,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: `${base}/keywords${impersonateParam}`,
      matchHref: `${base}/keywords`,
      label: "Keywords",
      icon: Search,
    },
    {
      href: `${base}/strategy${impersonateParam}`,
      matchHref: `${base}/strategy`,
      label: "SEO Strategy",
      icon: Target,
    },
    {
      href: `${base}/reports${impersonateParam}`,
      matchHref: `${base}/reports`,
      label: "Monthly Reports",
      icon: FileText,
    },
    {
      href: `${base}/ai-visibility${impersonateParam}`,
      matchHref: `${base}/ai-visibility`,
      label: "AI Visibility",
      icon: Sparkles,
    },
    {
      href: `${base}/approvals${impersonateParam}`,
      matchHref: `${base}/approvals`,
      label: "Approvals",
      icon: ShieldCheck,
    },
    {
      href: `${base}/messages${impersonateParam}`,
      matchHref: `${base}/messages`,
      label: "Messages",
      icon: MessageCircle,
    },
  ];

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-white fixed left-0 top-0 z-30 shadow-xl">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/60">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm flex-shrink-0">
          {themeConfig.brand.shortName}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate text-white">
            {themeConfig.brand.name}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {themeConfig.brand.tagline}
          </p>
        </div>
      </div>

      {/* Client info */}
      <div className="px-4 py-3 border-b border-slate-700/60">
        <p className="text-sm font-semibold text-white truncate">{clientName}</p>
        <p className="text-xs text-slate-400 truncate">{clientDomain}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ href, matchHref, label, icon: Icon }) => {
          const isActive = pathname.startsWith(matchHref);
          return (
            <Link
              key={matchHref}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-slate-700/60 px-3 py-3 space-y-2">
        <div className="px-3 py-1">
          <p className="text-sm font-medium truncate text-white">{userName}</p>
          <p className="text-xs text-slate-400 truncate">{userEmail}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

export function PortalSidebar(props: PortalSidebarProps) {
  return (
    <Suspense
      fallback={
        <aside className="flex h-full w-64 flex-col bg-slate-900 text-white fixed left-0 top-0 z-30 shadow-xl" />
      }
    >
      <PortalSidebarInner {...props} />
    </Suspense>
  );
}
