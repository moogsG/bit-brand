import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clients, seoStrategies } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/admin-header";
import { NorthStarRibbon } from "@/components/shared/north-star-ribbon";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StrategyEditor } from "@/components/admin/strategy-editor";
import { phase2Flags } from "@/lib/flags";
import { buildPromptResearchRecommendations } from "@/lib/prompt-research/recommendations";

export default async function AdminStrategyEditorPage({
	params,
}: {
	params: Promise<{ id: string; strategyId: string }>;
}) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	const { id, strategyId } = await params;

	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.id, id))
		.get();

	if (!client) notFound();

	const strategy = await db
		.select()
		.from(seoStrategies)
		.where(
			and(eq(seoStrategies.id, strategyId), eq(seoStrategies.clientId, id)),
		)
		.get();

	if (!strategy) notFound();

	let sections: {
		id: string;
		title: string;
		content: string;
		order: number;
	}[] = [];
	try {
		const parsed = JSON.parse(strategy.sections) as unknown;
		if (Array.isArray(parsed)) {
			sections = parsed as typeof sections;
		}
	} catch {
		sections = [];
	}

	let promptResearchRecommendations: Array<{
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
				limit: 3,
			});

			promptResearchRecommendations = promptResearch.recommendations
				.slice(0, 3)
				.map((recommendation) => ({
					id: recommendation.id,
					title: recommendation.title,
					priority: recommendation.priority,
					rationale: recommendation.rationale,
				}));
		} catch {
			promptResearchRecommendations = [];
		}
	}

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			<AdminHeader title={`Edit Strategy — ${client.name}`} />
			<main className="flex-1 overflow-y-auto p-6 space-y-6">
				<Link
					href={`/admin/clients/${id}/strategy`}
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					All Strategies
				</Link>

				<NorthStarRibbon
					clientId={id}
					onboardingHref={`/admin/clients/${id}/onboarding`}
				/>

				<StrategyEditor
					strategyId={strategyId}
					initialTitle={strategy.title}
					initialSections={sections}
					initialStatus={strategy.status ?? "DRAFT"}
					promptResearchRecommendations={promptResearchRecommendations}
				/>
			</main>
		</div>
	);
}
