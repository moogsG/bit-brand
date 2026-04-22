import { z } from "zod";
import type { ClientContextPayload } from "@/lib/ai/context-builder";

export const lensModuleSchema = z.enum([
	"dashboard",
	"goal-planning",
	"onboarding",
	"keywords",
	"prompt-research",
	"technical",
	"strategy",
	"reports",
	"reporting",
	"ai-visibility",
]);

export type LensModule = z.infer<typeof lensModuleSchema>;

const recommendationPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const recommendationConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const lensRecommendationSchema = z.object({
	id: z.string(),
	type: z.enum(["PLACEHOLDER_RULE_BASED", "LENS_ROUTER_V2_RULE_BASED"]),
	module: lensModuleSchema,
	lensKey: z.string().min(1).optional(),
	lensDisplayName: z.string().min(1).optional(),
	summary: z.string(),
	rationale: z.string(),
	priority: recommendationPrioritySchema,
	confidence: recommendationConfidenceSchema,
	safePreviewOnly: z.literal(true),
	signals: z
		.array(
			z.object({
				code: z.string(),
				label: z.string(),
				value: z.string().nullable(),
			}),
		)
		.min(1),
	suggestedActions: z
		.array(
			z.object({
				action: z.string(),
				detail: z.string(),
			}),
		)
		.min(1),
	// Module-specific extra payload (deterministic, non-mutating).
	details: z.record(z.string(), z.unknown()).optional(),
});

export type LensRecommendation = z.infer<typeof lensRecommendationSchema>;

function normalizeMetric(value: number | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	return Number(value).toFixed(2);
}

function buildSignals(
	context: ClientContextPayload,
): LensRecommendation["signals"] {
	return [
		{
			code: "health-status",
			label: "Health status",
			value: context.kpis.health.status,
		},
		{
			code: "organic-change-30d",
			label: "Organic sessions change % (30d)",
			value: normalizeMetric(context.kpis.organicSessions30d.changePct),
		},
		{
			code: "clicks-change-30d",
			label: "Clicks change % (30d)",
			value: normalizeMetric(context.kpis.totalClicks30d.changePct),
		},
		{
			code: "open-opportunity-signals",
			label: "Opportunity signal count",
			value: String(context.opportunities.items.length),
		},
		{
			code: "open-risk-signals",
			label: "Risk signal count",
			value: String(context.risks.items.length),
		},
		{
			code: "north-star-defined",
			label: "North Star statement defined",
			value: context.onboarding.northStar.statement ? "yes" : "no",
		},
	];
}

function resolveRule(
	module: LensModule,
	question: string,
	context: ClientContextPayload,
): {
	ruleKey: string;
	summary: string;
	rationale: string;
	priority: LensRecommendation["priority"];
	confidence: LensRecommendation["confidence"];
	suggestedActions: LensRecommendation["suggestedActions"];
} {
	const questionNormalized = question.toLowerCase();
	const healthStatus = context.kpis.health.status;
	const organicChange = context.kpis.organicSessions30d.changePct;
	const aiVisibility = context.kpis.aiVisibilityOverall.current;

	if (healthStatus === "CRITICAL") {
		return {
			ruleKey: "critical-health",
			summary:
				"Stabilize delivery risk first, then continue module execution planning.",
			rationale:
				"Critical health status is present in shared context and should be treated as the highest-priority constraint.",
			priority: "HIGH",
			confidence: "HIGH",
			suggestedActions: [
				{
					action: "review-health-reasons",
					detail:
						"Review health reasons and unresolved blockers before scheduling net-new work.",
				},
				{
					action: "create-risk-mitigation-plan",
					detail:
						"Draft a mitigation plan with owners and deadlines for the top two risk drivers.",
				},
			],
		};
	}

	if (module === "keywords" && organicChange !== null && organicChange < 0) {
		return {
			ruleKey: "keywords-recovery",
			summary:
				"Prioritize keyword recovery work for high-priority terms with slipping traffic.",
			rationale:
				"Organic sessions trend is negative and the active lens is keywords, indicating ranking recovery should be prioritized.",
			priority: "HIGH",
			confidence: "MEDIUM",
			suggestedActions: [
				{
					action: "audit-top-keywords",
					detail:
						"Audit high-priority keywords where current position is behind target and annotate likely causes.",
				},
				{
					action: "publish-quick-win-updates",
					detail:
						"Ship quick on-page updates for the top impacted URLs before the next reporting cycle.",
				},
			],
		};
	}

	if (
		module === "ai-visibility" &&
		aiVisibility !== null &&
		aiVisibility < 60
	) {
		return {
			ruleKey: "ai-visibility-gap",
			summary:
				"Increase AI visibility coverage on core prompts and entity mentions.",
			rationale:
				"AI visibility score is below threshold for this client and indicates coverage or authority gaps.",
			priority: "MEDIUM",
			confidence: "MEDIUM",
			suggestedActions: [
				{
					action: "prioritize-high-intent-prompts",
					detail:
						"Prioritize 5 high-intent prompts and map missing brand mentions to supporting pages.",
				},
				{
					action: "plan-evidence-updates",
					detail:
						"Plan evidence updates (citations, stats, proof points) for pages tied to weak prompt visibility.",
				},
			],
		};
	}

	if (!context.onboarding.northStar.statement) {
		return {
			ruleKey: "north-star-missing",
			summary:
				"Capture or refresh the North Star statement before planning deeper module work.",
			rationale:
				"A clear North Star is missing, reducing recommendation precision across assistant modules.",
			priority: "MEDIUM",
			confidence: "MEDIUM",
			suggestedActions: [
				{
					action: "finalize-north-star",
					detail:
						"Confirm the target metric, target date, and owner so downstream planning has a stable anchor.",
				},
			],
		};
	}

	if (questionNormalized.includes("quick win")) {
		return {
			ruleKey: "quick-win-focus",
			summary:
				"Focus this module on the fastest measurable improvements first.",
			rationale:
				"The question asks for quick wins, so recommendations are biased toward short-cycle tasks with low dependency risk.",
			priority: "MEDIUM",
			confidence: "MEDIUM",
			suggestedActions: [
				{
					action: "select-two-fastest-actions",
					detail:
						"Pick two actions deliverable in under one sprint and set expected KPI movement.",
				},
			],
		};
	}

	return {
		ruleKey: "default-monitor-and-plan",
		summary: "Proceed with a conservative plan-review loop for this module.",
		rationale:
			"No high-severity trigger matched, so the placeholder assistant returns a plan-first recommendation.",
		priority: "LOW",
		confidence: "LOW",
		suggestedActions: [
			{
				action: "review-context-signals",
				detail:
					"Review context signals and select one measurable focus area before execution proposals.",
			},
		],
	};
}

interface BuildLensRecommendationParams {
	module: LensModule;
	question: string;
	context: ClientContextPayload;
	lensMeta?: { key: string; displayName: string };
	detailsOverrides?: Record<string, unknown>;
}

function buildV2SuggestedActions(params: {
	module: LensModule;
	baseActions: LensRecommendation["suggestedActions"];
}): LensRecommendation["suggestedActions"] {
	if (params.module === "ai-visibility") {
		return [
			...params.baseActions,
			{
				action: "triangulate-engine-deltas",
				detail:
					"Compare visibility deltas across ChatGPT, Gemini, and Perplexity prompts before finalizing weekly priorities.",
			},
		];
	}

	if (params.module === "keywords") {
		return [
			...params.baseActions,
			{
				action: "map-keywords-to-ai-prompt-gaps",
				detail:
					"Map priority keywords to overlapping prompt intents so visibility and ranking work stay aligned.",
			},
		];
	}

	return params.baseActions;
}

export function buildLensRecommendation({
	module,
	question,
	context,
	lensMeta,
}: BuildLensRecommendationParams): LensRecommendation {
	const rule = resolveRule(module, question, context);

	const recommendation: LensRecommendation = {
		id: `rec-${module}-${rule.ruleKey}`,
		type: "PLACEHOLDER_RULE_BASED",
		module,
		lensKey: lensMeta?.key,
		lensDisplayName: lensMeta?.displayName,
		summary: rule.summary,
		rationale: rule.rationale,
		priority: rule.priority,
		confidence: rule.confidence,
		safePreviewOnly: true,
		signals: buildSignals(context),
		suggestedActions: rule.suggestedActions,
	};

	return lensRecommendationSchema.parse(recommendation);
}

export function buildLensRecommendationV2({
	module,
	question,
	context,
	lensMeta,
	detailsOverrides,
}: BuildLensRecommendationParams): LensRecommendation {
	const rule = resolveRule(module, question, context);

	const baseDetails = (() => {
		const northStar = context.onboarding.northStar.statement;
		const health = context.kpis.health.status;
		const organicChange = context.kpis.organicSessions30d.changePct;
		const clicksChange = context.kpis.totalClicks30d.changePct;
		const aiScore = context.kpis.aiVisibilityOverall.current;

		if (module === "goal-planning") {
			return {
				levers: [
					{
						lever: "Content",
						impact:
							organicChange !== null && organicChange < 0 ? "HIGH" : "MEDIUM",
					},
					{
						lever: "Technical",
						impact: health === "CRITICAL" ? "HIGH" : "MEDIUM",
					},
					{
						lever: "Authority",
						impact: aiScore !== null && aiScore < 60 ? "HIGH" : "MEDIUM",
					},
				],
				milestones: [
					{
						horizon: "30d",
						goal: northStar ? "Move leading indicators" : "Define North Star",
					},
					{ horizon: "90d", goal: "Ship prioritized lever roadmap" },
				],
			};
		}

		if (module === "keywords") {
			return {
				clusters: [
					{
						name: "High-intent opportunities",
						note: "Prioritize terms with clear landing page intent.",
					},
					{
						name: "Quick win updates",
						note: "Refresh existing pages aligned to priority terms.",
					},
				],
				opportunities: [
					{
						suggestion: "Target 5 medium-difficulty terms tied to conversions",
						signal: String(clicksChange ?? ""),
					},
				],
			};
		}

		if (module === "prompt-research" || module === "ai-visibility") {
			return {
				citationInsights: [
					{
						focus: "Top cited domains",
						note: "Compare recurring domains and content formats.",
					},
					{
						focus: "Freshness patterns",
						note: "Prefer recent sources for volatile topics.",
					},
				],
				gapFocus: [
					{
						action: "Map uncovered prompts to keyword targets",
						threshold: 0.35,
					},
					{
						action: "Create evidence-first updates for weak prompts",
						threshold: 0.35,
					},
				],
			};
		}

		if (module === "technical") {
			return {
				auditCategories: [
					"Indexability",
					"Schema",
					"Performance",
					"Internal linking",
				],
				recommendedFixOrder:
					health === "CRITICAL"
						? ["Indexability", "Performance"]
						: ["Schema", "Internal linking"],
			};
		}

		if (module === "reports" || module === "reporting") {
			return {
				narrativeOutline: [
					"What changed",
					"Why it changed",
					"What we did",
					"What we will do next",
				],
				anomalies: [
					organicChange !== null && Math.abs(organicChange) >= 10
						? `Organic sessions moved ${organicChange.toFixed(1)}%`
						: "No major organic anomaly detected",
				],
			};
		}

		return {};
	})();

	const details = detailsOverrides
		? {
				...baseDetails,
				...detailsOverrides,
			}
		: baseDetails;

	const recommendation: LensRecommendation = {
		id: `rec-v2-${module}-${rule.ruleKey}`,
		type: "LENS_ROUTER_V2_RULE_BASED",
		module,
		lensKey: lensMeta?.key,
		lensDisplayName: lensMeta?.displayName,
		summary: `[Lens Router v2] ${rule.summary}`,
		rationale: `${rule.rationale} This recommendation used module-aware v2 routing.`,
		priority: rule.priority,
		confidence: rule.confidence,
		safePreviewOnly: true,
		signals: buildSignals(context),
		suggestedActions: buildV2SuggestedActions({
			module,
			baseActions: rule.suggestedActions,
		}),
		details,
	};

	return lensRecommendationSchema.parse(recommendation);
}
