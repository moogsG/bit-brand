import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { ProfileSettingsForm } from "@/components/admin/profile-settings-form";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { themeConfig } from "@/lib/theme.config";

type SettingsTab = "profile" | "admin";

function tabClassName(active: boolean): string {
	if (active) {
		return "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground";
	}

	return "rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";
}

export default async function AdminSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	const canEditSettings = can("settings", "edit", { session });
	const canViewSettings = canEditSettings || can("settings", "view", { session });
	if (!canViewSettings) {
		redirect("/portal");
	}

	const { tab } = await searchParams;
	const activeTab: SettingsTab = tab === "admin" ? "admin" : "profile";

	const canViewApiCredentials = can("apiCredentials", "view", { session });
	const canExportAllData = can("export", "execute", { session });

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			<AdminHeader title="Settings" />
			<main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
				<div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
					<Link href="/admin/settings?tab=profile" className={tabClassName(activeTab === "profile")}>
						Profile
					</Link>
					<Link href="/admin/settings?tab=admin" className={tabClassName(activeTab === "admin")}>
						Admin
					</Link>
				</div>

				{activeTab === "profile" && (
					<>
						<Card>
							<CardHeader className="border-b">
								<CardTitle>Profile</CardTitle>
								<CardDescription>
									Update your display name and profile photo.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6 pt-5">
								<div className="space-y-3">
									<div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm">
										<span className="font-medium text-muted-foreground">Email</span>
										<span className="font-medium">{session.user.email ?? "—"}</span>
									</div>
									<div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm">
										<span className="font-medium text-muted-foreground">Role</span>
										<Badge variant="secondary" className="w-fit">
											{session.user.rawRole ?? session.user.role}
										</Badge>
									</div>
								</div>

								<div className="border-t" />

								<ProfileSettingsForm
									initialName={session.user.name ?? ""}
									initialEmail={session.user.email ?? ""}
									initialAvatarUrl={session.user.image ?? null}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="border-b">
								<CardTitle>Security</CardTitle>
								<CardDescription>Change your account password.</CardDescription>
							</CardHeader>
							<CardContent className="pt-5">
								<ChangePasswordForm />
							</CardContent>
						</Card>
					</>
				)}

				{activeTab === "admin" && (
					<>
						<Card>
							<CardHeader className="border-b">
								<CardTitle>Portal Settings</CardTitle>
								<CardDescription>
									Branding configuration for the client portal.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 pt-5">
								<div className="grid gap-3 text-sm">
									<div className="grid grid-cols-[140px_1fr] items-center gap-2">
										<span className="font-medium text-muted-foreground">
											Portal Name
										</span>
										<span className="font-medium">{themeConfig.brand.name}</span>
									</div>
									<div className="grid grid-cols-[140px_1fr] items-center gap-2">
										<span className="font-medium text-muted-foreground">
											Short Name
										</span>
										<span className="font-medium">{themeConfig.brand.shortName}</span>
									</div>
									<div className="grid grid-cols-[140px_1fr] items-center gap-2">
										<span className="font-medium text-muted-foreground">
											Tagline
										</span>
										<span className="font-medium">{themeConfig.brand.tagline}</span>
									</div>
								</div>

								<div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
									To update branding, edit <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">src/lib/theme.config.ts</code> and provide brand assets.
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="border-b">
								<CardTitle>Integrations</CardTitle>
								<CardDescription>
									Manage agency API credentials used across clients.
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-5">
								{canViewApiCredentials ? (
									<Link
										href="/admin/settings/api-credentials"
										className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										Manage API Credentials
									</Link>
								) : (
									<p className="text-sm text-muted-foreground">
										You do not have permission to manage API credentials.
									</p>
								)}
							</CardContent>
						</Card>

						{canEditSettings && (
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
												Download a JSON export of all clients and portal users. No API credentials or secrets are included.
											</p>
										</div>
										{canExportAllData ? (
											<a
												href="/api/settings/export"
												download
												className="inline-flex shrink-0 items-center justify-center rounded-md border border-destructive/60 bg-background px-4 py-2 text-sm font-medium text-destructive shadow-xs transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
											>
												Export All Data
											</a>
										) : null}
									</div>
								</CardContent>
							</Card>
						)}
					</>
				)}
			</main>
		</div>
	);
}
