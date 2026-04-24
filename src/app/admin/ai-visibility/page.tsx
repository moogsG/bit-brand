import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-header";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { aiVisibility, clients } from "@/lib/db/schema";

export default async function AgencyAiVisibilityPage() {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	if (!can("aiVisibility", "view", { session })) {
		redirect("/admin/dashboard");
	}

	const [activeClients, aiRows] = await Promise.all([
		db
			.select({ id: clients.id, name: clients.name, slug: clients.slug })
			.from(clients)
			.where(eq(clients.isActive, true))
			.all(),
		db.select().from(aiVisibility).orderBy(desc(aiVisibility.date)).all(),
	]);

	const latestByClientId = new Map<string, (typeof aiRows)[number]>();
	for (const row of aiRows) {
		if (!latestByClientId.has(row.clientId)) {
			latestByClientId.set(row.clientId, row);
		}
	}

	const rows = activeClients
		.map((client) => ({
			client,
			latest: latestByClientId.get(client.id) ?? null,
		}))
		.sort((a, b) => {
			const aScore = a.latest?.overallScore ?? -1;
			const bScore = b.latest?.overallScore ?? -1;
			return bScore - aScore;
		});

	const tracked = rows.filter((row) => row.latest && row.latest.overallScore !== null);
	const avgScore =
		tracked.length > 0
			? Math.round(
					tracked.reduce((sum, row) => sum + (row.latest?.overallScore ?? 0), 0) /
						tracked.length,
				)
			: null;
	const healthyCount = tracked.filter(
		(row) => (row.latest?.overallScore ?? 0) >= 70,
	).length;
	const atRiskCount = tracked.filter(
		(row) => (row.latest?.overallScore ?? 0) < 40,
	).length;

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<AdminHeader title="AI Visibility" />
			<main className="flex-1 space-y-6 overflow-y-auto p-6">
				<div className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-violet-500" />
					<div>
						<h1 className="text-xl font-bold">Agency AI Visibility Overview</h1>
						<p className="text-sm text-muted-foreground">
							Cross-client AI visibility health and quick access to each client view.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Active Clients</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{activeClients.length}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Tracked Clients</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{tracked.length}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Average Score</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{avgScore ?? "—"}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Health Split</CardTitle>
							<CardDescription>Healthy vs at-risk</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm">
								<span className="font-semibold text-emerald-600">{healthyCount}</span>
								<span className="text-muted-foreground"> healthy</span>
							</p>
							<p className="text-sm">
								<span className="font-semibold text-destructive">{atRiskCount}</span>
								<span className="text-muted-foreground"> at risk</span>
							</p>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Client AI Visibility</CardTitle>
						<CardDescription>
							Latest snapshot per active client.
						</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border bg-muted/40">
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Client</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Score</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Visible Prompts</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Last Date</th>
										<th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{rows.map(({ client, latest }) => (
										<tr key={client.id}>
											<td className="px-4 py-3 font-medium">{client.name}</td>
											<td className="px-4 py-3">{latest?.overallScore !== null && latest?.overallScore !== undefined ? Math.round(latest.overallScore) : "—"}</td>
											<td className="px-4 py-3 text-muted-foreground">
												{latest
													? `${latest.promptsVisible ?? 0}/${latest.totalPromptsTested ?? 0}`
													: "—"}
											</td>
											<td className="px-4 py-3 text-muted-foreground">{latest?.date ?? "—"}</td>
											<td className="px-4 py-3 text-right">
												<div className="inline-flex gap-3">
													<Link href={`/admin/clients/${client.id}?tab=ai-visibility`} className="text-xs font-medium text-primary hover:underline">
														Tab
													</Link>
													<Link href={`/admin/clients/${client.id}/ai-visibility`} className="text-xs font-medium text-primary hover:underline">
														Detail
													</Link>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
