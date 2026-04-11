"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PortalHeaderProps {
  userName: string;
  userEmail: string;
}

function derivePageTitle(pathname: string): string {
  const segment = pathname.split("/").pop() ?? "";
  const titleMap: Record<string, string> = {
    dashboard: "Dashboard",
    keywords: "Keyword Research",
    strategy: "SEO Strategy",
    reports: "Monthly Reports",
    "ai-visibility": "AI Search Visibility",
  };
  return titleMap[segment] ?? "Portal";
}

function userInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PortalHeader({ userName, userEmail }: PortalHeaderProps) {
  const pathname = usePathname();
  const pageTitle = derivePageTitle(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>

      <DropdownMenu>
        {/* DropdownMenuTrigger renders as a button natively via base-ui */}
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted transition-colors outline-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-semibold flex-shrink-0">
            {userInitials(userName)}
          </div>
          <span className="hidden sm:block">{userName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5 text-xs text-muted-foreground truncate border-b mb-1">
            {userEmail}
          </div>
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="gap-2 cursor-pointer"
            variant="destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
