"use client";

import {
	FileText,
	GitCommitHorizontal,
	LayoutDashboard,
	Bell,
	LogOut,
	MessageCircle,
	Search,
	ShieldCheck,
	Sparkles,
	Target,
	Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/authorize";
import type { PermissionModule } from "@/lib/auth/permissions";
import { themeConfig } from "@/lib/theme.config";
import { cn } from "@/lib/utils";

interface PortalSidebarProps {
	clientName: string;
	clientDomain: string;
	clientSlug: string;
	userName: string;
	userEmail: string;
	userRole: string;
	userRawRole?: string;
	portalV2Enabled?: boolean;
}

function PortalSidebarInner({
	clientName,
	clientDomain,
	clientSlug,
	userName,
	userEmail,
	userRole,
	userRawRole,
	portalV2Enabled = false,
}: PortalSidebarProps) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const isImpersonating = searchParams.get("impersonate") === "true";
	const impersonateParam = isImpersonating ? "?impersonate=true" : "";

	const base = `/portal/${clientSlug}`;

	const navItems: {
		href: string;
		matchHref: string;
		label: string;
		icon: typeof LayoutDashboard;
		module: PermissionModule;
	}[] = [
		{
			href: `${base}/dashboard${impersonateParam}`,
			matchHref: `${base}/dashboard`,
			label: "Dashboard",
			icon: LayoutDashboard,
			module: "portal",
		},
		{
			href: `${base}/keywords${impersonateParam}`,
			matchHref: `${base}/keywords`,
			label: "Keywords",
			icon: Search,
			module: "keywords",
		},
		{
			href: `${base}/strategy${impersonateParam}`,
			matchHref: `${base}/strategy`,
			label: "SEO Strategy",
			icon: Target,
			module: "strategies",
		},
		{
			href: `${base}/reports${impersonateParam}`,
			matchHref: `${base}/reports`,
			label: "Monthly Reports",
			icon: FileText,
			module: "reports",
		},
		{
			href: `${base}/ai-visibility${impersonateParam}`,
			matchHref: `${base}/ai-visibility`,
			label: "AI Visibility",
			icon: Sparkles,
			module: "aiVisibility",
		},
		{
			href: `${base}/implementation${impersonateParam}`,
			matchHref: `${base}/implementation`,
			label: "Implementation Changes",
			icon: GitCommitHorizontal,
			module: "technical",
		},
		{
			href: `${base}/technical${impersonateParam}`,
			matchHref: `${base}/technical`,
			label: "Technical",
			icon: Wrench,
			module: "technical",
		},
		{
			href: `${base}/eeat-questionnaire${impersonateParam}`,
			matchHref: `${base}/eeat-questionnaire`,
			label: "EEAT Questionnaire",
			icon: ShieldCheck,
			module: "content",
		},
		{
			href: `${base}/approvals${impersonateParam}`,
			matchHref: `${base}/approvals`,
			label: "Approvals",
			icon: ShieldCheck,
			module: "approvals",
		},
		{
			href: `${base}/notifications${impersonateParam}`,
			matchHref: `${base}/notifications`,
			label: "Notifications",
			icon: Bell,
			module: "notifications",
		},
		{
			href: `${base}/messages${impersonateParam}`,
			matchHref: `${base}/messages`,
			label: "Messages",
			icon: MessageCircle,
			module: "messages",
		},
	];

	const visibleNavItems = navItems.filter((item) => {
		if (
			!portalV2Enabled &&
			(item.matchHref === `${base}/approvals` ||
				item.matchHref === `${base}/notifications` ||
				item.matchHref === `${base}/eeat-questionnaire`)
		) {
			return false;
		}

		return can(item.module, "view", { role: userRole, rawRole: userRawRole });
	});

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
				<p className="text-sm font-semibold text-white truncate">
					{clientName}
				</p>
				<p className="text-xs text-slate-400 truncate">{clientDomain}</p>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
				{visibleNavItems.map(({ href, matchHref, label, icon: Icon }) => {
					const isActive = pathname.startsWith(matchHref);
					return (
						<Link
							key={matchHref}
							href={href}
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
								isActive
									? "bg-indigo-600 text-white"
									: "text-slate-300 hover:bg-slate-800 hover:text-white",
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
