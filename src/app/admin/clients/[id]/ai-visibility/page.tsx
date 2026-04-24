import { and, desc, eq, gte } from "drizzle-orm";
import { ArrowLeft, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ClientSectionsNav } from "@/components/admin/client-sections-nav";
import { AiVisibilityTrendChart } from "@/components/portal/ai-visibility-trend-chart";
import { PromptResultsTable } from "@/components/portal/prompt-results-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { aiVisibility, clients, rankscaleMetrics } from "@/lib/db/schema";
import { phase2Flags } from "@/lib/flags";
import { buildPromptResearchRecommendations } from "@/lib/prompt-research/recommendations";

function toDateStr(date: Date): string {
	return date.toISOString().split("T")[0] ?? "";
}

export default async function AdminClientAiVisibilityPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	const { id } = await params;
	const accessContext = await getClientAccessContext(session, id);

	if (!can("aiVisibility", "view", { session, clientId: id, ...accessContext })) {
		redirect(`/admin/clients/${id}?tab=dashboard`);
	}

	const client = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, id), eq(clients.isActive, true)))
		.get();

	if (!client) notFound();

	const twelveMonthsAgo = new Date();
	twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
	const startDate = toDateStr(twelveMonthsAgo);

	const [aiVisRows, promptRows] = await Promise.all([
		db
			.select()
			.from(aiVisibility)
			.where(
				and(eq(aiVisibility.clientId, client.id), gte(aiVisibility.date, startDate)),
			)
			.orderBy(aiVisibility.date)
			.all(),

		db
			.select()
			.from(rankscaleMetrics)
			.where(
				and(
					eq(rankscaleMetrics.clientId, client.id),
					gte(rankscaleMetrics.date, startDate),
				),
			)
			.orderBy(desc(rankscaleMetrics.date))
			.all(),
	]);

	const latest = aiVisRows.length > 0 ? aiVisRows[aiVisRows.length - 1] : null;
	const previous = aiVisRows.length > 1 ? aiVisRows[aiVisRows.length - 2] : null;
	const trend =
		latest?.overallScore !== null &&
		latest?.overallScore !== undefined &&
		previous?.overallScore !== null &&
		previous?.overallScore !== undefined
			? latest.overallScore - previous.overallScore
			: null;

	let recommendations: Array<{
		id: string;
		title: string;
		priority: "HIGH" | "MEDIUM" | "LOW";
		rationale: string;
	}> = [];

	if (phase2Flags.promptResearchV1()) {
		try {
			const promptResearch = await buildPromptResearchRecommendations({
				clientId: id,
				windowDays: 90,
				limit: 5,
			});

			recommendations = promptResearch.recommendations.slice(0, 5).map((r) => ({
				id: r.id,
				title: r.title,
				priority: r.priority,
				rationale: r.rationale,
			}));
		} catch {
			recommendations = [];
		}
	}

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<AdminHeader title={`${client.name} — AI Visibility`} />
			<main className="flex-1 space-y-6 overflow-y-auto p-6">
				<div className="space-y-3">
					<Link
						href={`/admin/clients/${id}?tab=dashboard`}
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to {client.name}
					</Link>
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-violet-500" />
						<div>
							<h1 className="text-xl font-bold">AI Visibility</h1>
							<p className="text-sm text-muted-foreground">
								Admin view of AI search visibility and prompt-level performance.
							</p>
						</div>
					</div>
				</div>

				<ClientSectionsNav clientId={id} active="aiVisibility" />

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Overall Score</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">
								{latest?.overallScore !== null && latest?.overallScore !== undefined
									? Math.round(latest.overallScore)
									: "—"}
							</p>
							{trend !== null ? (
								<p
									className={`mt-1 inline-flex items-center gap-1 text-xs ${
										trend >= 0 ? "text-emerald-600" : "text-destructive"
									}`}
								>
									{trend >= 0 ? (
										<TrendingUp className="h-3 w-3" />
									) : (
										<TrendingDown className="h-3 w-3" />
									)}
									{Math.abs(Math.round(trend))} vs previous
								</p>
							) : (
								<p className="mt-1 text-xs text-muted-foreground">No trend yet</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Rankscale Score</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">
								{latest?.rankscaleScore !== null && latest?.rankscaleScore !== undefined
									? Math.round(latest.rankscaleScore)
									: "—"}
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Prompts Visible</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">
								{latest?.promptsVisible ?? 0}
								<span className="ml-1 text-base font-normal text-muted-foreground">
									/ {latest?.totalPromptsTested ?? 0}
								</span>
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Prompt Results</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{promptRows.length}</p>
							<p className="mt-1 text-xs text-muted-foreground">Last 12 months</p>
						</CardContent>
					</Card>
				</div>

				{aiVisRows.length > 1 ? (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								AI Visibility Trend (Last 12 Months)
							</CardTitle>
						</CardHeader>
						<CardContent>
							<AiVisibilityTrendChart
								data={aiVisRows.map((row) => ({
									date: row.date,
									overallScore: row.overallScore,
								}))}
							/>
						</CardContent>
					</Card>
				) : null}

				{recommendations.length > 0 ? (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Prompt Research Insights</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{recommendations.map((recommendation) => (
								<div key={recommendation.id} className="rounded-md border p-3">
									<div className="flex items-center justify-between gap-3">
										<p className="text-sm font-medium">{recommendation.title}</p>
										<span className="text-xs text-muted-foreground">
											{recommendation.priority}
										</span>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										{recommendation.rationale}
									</p>
								</div>
							))}
						</CardContent>
					</Card>
				) : null}

				{promptRows.length > 0 ? (
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold">Prompt Results</h3>
							<p className="text-sm text-muted-foreground">
								All tested prompts across AI platforms.
							</p>
						</div>
						<PromptResultsTable
							prompts={promptRows.map((row) => ({
								id: row.id,
								prompt: row.prompt,
								platform: row.platform,
								isVisible: row.isVisible,
								position: row.position,
								visibilityScore: row.visibilityScore,
								date: row.date,
							}))}
						/>
					</div>
				) : (
					<Card>
						<CardContent className="py-10 text-center text-sm text-muted-foreground">
							No prompt result data yet.
						</CardContent>
					</Card>
				)}
			</main>
		</div>
	);
}
