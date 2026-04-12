import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { themeConfig } from "@/lib/theme.config";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const INTEGRATIONS = [
	{ name: "Google Analytics 4", key: "GA4", scope: "Agency" },
	{ name: "Google Search Console", key: "GSC", scope: "Agency" },
	{ name: "Moz", key: "MOZ", scope: "Agency" },
	{ name: "DataForSEO", key: "DATAFORSEO", scope: "Agency" },
	{ name: "RankScale", key: "RANKSCALE", scope: "Agency" },
] as const;

export default async function AdminSettingsPage() {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			<AdminHeader title="Settings" />
			<main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
				{/* ── 1. Account Settings ──────────────────────────────────────────── */}
				<Card>
					<CardHeader className="border-b">
						<CardTitle>Account Settings</CardTitle>
						<CardDescription>Your admin account information.</CardDescription>
					</CardHeader>
					<CardContent className="pt-5 space-y-6">
						{/* Current user info */}
						<div className="space-y-3">
							<div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm">
								<span className="text-muted-foreground font-medium">Name</span>
								<span className="font-medium">{session.user.name ?? "—"}</span>
							</div>
							<div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm">
								<span className="text-muted-foreground font-medium">Email</span>
								<span className="font-medium">{session.user.email ?? "—"}</span>
							</div>
							<div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm">
								<span className="text-muted-foreground font-medium">Role</span>
								<Badge variant="secondary" className="w-fit">
									Admin
								</Badge>
							</div>
						</div>

						{/* Divider */}
						<div className="border-t" />

						{/* Change password */}
						<div className="space-y-3">
							<div>
								<h3 className="text-sm font-semibold">Change Password</h3>
								<p className="text-xs text-muted-foreground mt-0.5">
									Update your admin account password.
								</p>
							</div>
							<ChangePasswordForm />
						</div>
					</CardContent>
				</Card>

				{/* ── 2. Portal Settings ───────────────────────────────────────────── */}
				<Card>
					<CardHeader className="border-b">
						<CardTitle>Portal Settings</CardTitle>
						<CardDescription>
							Branding configuration for the client portal.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-5 space-y-4">
						<div className="grid gap-3 text-sm">
							<div className="grid grid-cols-[140px_1fr] items-center gap-2">
								<span className="text-muted-foreground font-medium">
									Portal Name
								</span>
								<span className="font-medium">{themeConfig.brand.name}</span>
							</div>
							<div className="grid grid-cols-[140px_1fr] items-center gap-2">
								<span className="text-muted-foreground font-medium">
									Short Name
								</span>
								<span className="font-medium">
									{themeConfig.brand.shortName}
								</span>
							</div>
							<div className="grid grid-cols-[140px_1fr] items-center gap-2">
								<span className="text-muted-foreground font-medium">
									Tagline
								</span>
								<span className="font-medium">{themeConfig.brand.tagline}</span>
							</div>
						</div>

						<div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
							To update branding, edit{" "}
							<code className="font-mono text-xs bg-muted rounded px-1 py-0.5">
								src/lib/theme.config.ts
							</code>{" "}
							and provide brand assets. Branding assets will be applied here
							once available.
						</div>
					</CardContent>
				</Card>

				{/* ── 3. Integration Defaults ──────────────────────────────────────── */}
				<Card>
					<CardHeader className="border-b">
						<CardTitle>Integration Defaults</CardTitle>
						<CardDescription>
							Available data integrations and their configuration scope.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-5 space-y-4">
						<div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
							Data syncs are triggered manually per client. Scheduled sync
							coming soon.
						</div>

						<div className="overflow-hidden rounded-lg border border-border">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border bg-muted/40">
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
											Integration
										</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
											Scope
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{INTEGRATIONS.map(({ name, key, scope }) => (
										<tr key={key}>
											<td className="px-4 py-3 font-medium">{name}</td>
											<td className="px-4 py-3">
												<Badge variant="secondary" className="text-xs">
													{scope}
												</Badge>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<Link
							href="/admin/settings/api-credentials"
							className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							Manage API Credentials
						</Link>
					</CardContent>
				</Card>

				{/* ── 4. Danger Zone ───────────────────────────────────────────────── */}
				<Card className="ring-destructive/30">
					<CardHeader className="border-b border-destructive/20">
						<CardTitle className="text-destructive">Danger Zone</CardTitle>
						<CardDescription>
							Irreversible or destructive actions. Proceed with care.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-5">
						<div className="flex items-start justify-between gap-4">
							<div className="space-y-1">
								<p className="text-sm font-medium">Export All Data</p>
								<p className="text-xs text-muted-foreground">
									Download a JSON export of all clients and portal users. No API
									credentials or secrets are included.
								</p>
							</div>
							<a
								href="/api/settings/export"
								download
								className="inline-flex shrink-0 items-center justify-center rounded-md border border-destructive/60 bg-background px-4 py-2 text-sm font-medium text-destructive shadow-xs transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
							>
								Export All Data
							</a>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
