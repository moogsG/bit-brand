import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
	aiVisibility,
	clients,
	ga4Metrics,
	gscMetrics,
	keywordResearch,
	monthlyReports,
	mozMetrics,
	seoStrategies,
} from "@/lib/db/schema";
import {
	buildEmptyOnboardingProfile,
	getOnboardingProfile,
	type OnboardingProfileResponse,
} from "@/lib/onboarding";
import {
	getDashboardClientHealthAggregateByClientId,
	type DashboardClientHealthAggregate,
} from "@/lib/dashboard/aggregates";

export const CLIENT_CONTEXT_VERSION = "1.0.0" as const;

const yyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const kpiSnapshotSchema = z.object({
	current: z.number().nullable(),
	previous: z.number().nullable(),
	changePct: z.number().nullable(),
	asOfDate: yyyyMmDdSchema.nullable(),
});

const contextStrategySummarySchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
	updatedAt: z.string().datetime(),
	publishedAt: z.string().datetime().nullable(),
	sectionCount: z.number().int().nonnegative(),
	nonEmptySectionCount: z.number().int().nonnegative(),
});

const contextReportSummarySchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
	month: z.number().int().min(1).max(12),
	year: z.number().int(),
	updatedAt: z.string().datetime(),
	publishedAt: z.string().datetime().nullable(),
	totalSections: z.number().int().nonnegative(),
	filledSectionCount: z.number().int().nonnegative(),
});

const opportunitySignalSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	source: z.enum(["KEYWORD", "ONBOARDING"]),
	confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

const riskSignalSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	source: z.enum(["HEALTH", "ONBOARDING"]),
	severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const clientContextPayloadSchema = z.object({
	version: z.literal(CLIENT_CONTEXT_VERSION),
	generatedAt: z.string().datetime(),
	clientId: z.string(),
	client: z.object({
		name: z.string().nullable(),
		domain: z.string().nullable(),
		slug: z.string().nullable(),
	}),
	onboarding: z.object({
		isOnboarded: z.boolean(),
		profileVersion: z.number().int().positive().nullable(),
		status: z.enum(["DRAFT", "COMPLETED"]).nullable(),
		completedAt: z.string().datetime().nullable(),
		northStar: z.object({
			statement: z.string().nullable(),
			metricName: z.string().nullable(),
			currentValue: z.number().nullable(),
			targetValue: z.number().nullable(),
			targetDate: z.string().nullable(),
			timeHorizonMonths: z.number().int().positive().nullable(),
		}),
		strategicLeversCount: z.number().int().nonnegative(),
		competitorsCount: z.number().int().nonnegative(),
	}),
	kpis: z.object({
		organicSessions30d: kpiSnapshotSchema,
		totalClicks30d: kpiSnapshotSchema,
		averagePosition30d: kpiSnapshotSchema,
		domainAuthority: z.object({
			current: z.number().nullable(),
			asOfDate: yyyyMmDdSchema.nullable(),
		}),
		aiVisibilityOverall: z.object({
			current: z.number().nullable(),
			asOfDate: yyyyMmDdSchema.nullable(),
		}),
		health: z.object({
			overallScore: z.number().nullable(),
			status: z.enum(["HEALTHY", "WATCH", "AT_RISK", "CRITICAL"]).nullable(),
			reasons: z.array(z.string()),
		}),
	}),
	activeArtifacts: z.object({
		strategies: z.array(contextStrategySummarySchema),
		reports: z.array(contextReportSummarySchema),
	}),
	opportunities: z.object({
		placeholder: z.string(),
		items: z.array(opportunitySignalSchema),
	}),
	risks: z.object({
		placeholder: z.string(),
		items: z.array(riskSignalSchema),
	}),
});

export type ClientContextPayload = z.infer<typeof clientContextPayloadSchema>;

interface KpiRawData {
	ga4Current: Array<{ date: string; organicSessions: number | null }>;
	ga4Previous: Array<{ date: string; organicSessions: number | null }>;
	gscCurrent: Array<{ clicks: number; avgPosition: number | null }>;
	gscPrevious: Array<{ clicks: number; avgPosition: number | null }>;
	mozLatest: { date: string; domainAuthority: number | null } | null;
	aiVisibilityLatest: { date: string; overallScore: number | null } | null;
}

interface StrategySummaryRow {
	id: string;
	title: string;
	status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
	updatedAt: Date | number;
	publishedAt: Date | number | null;
	sections: string;
}

interface ReportSummaryRow {
	id: string;
	title: string;
	status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
	month: number;
	year: number;
	updatedAt: Date | number;
	publishedAt: Date | number | null;
	sections: string;
}

interface OpportunityKeywordRow {
	id: string;
	keyword: string;
	priority: "HIGH" | "MEDIUM" | "LOW" | null;
	status: "OPPORTUNITY" | "TARGETING" | "RANKING" | "WON" | null;
}

export interface ClientContextBuilderDependencies {
	loadClientRecord: (
		clientId: string,
	) => Promise<{ name: string | null; domain: string | null; slug: string | null } | null>;
	loadOnboardingProfile: (clientId: string) => Promise<OnboardingProfileResponse>;
	loadHealthAggregate: (
		clientId: string,
	) => Promise<DashboardClientHealthAggregate | null>;
	loadKpiData: (clientId: string, now: Date) => Promise<KpiRawData>;
	loadActiveStrategies: (clientId: string) => Promise<StrategySummaryRow[]>;
	loadActiveReports: (clientId: string) => Promise<ReportSummaryRow[]>;
	loadKeywordOpportunities: (clientId: string) => Promise<OpportunityKeywordRow[]>;
}

export interface ClientContextBuilderOptions {
	now?: Date;
	dependencies?: Partial<ClientContextBuilderDependencies>;
}

function toDateString(date: Date): string {
	return date.toISOString().split("T")[0] ?? "";
}

function toIsoString(value: Date | number): string {
	const normalized = value instanceof Date ? value : new Date(value);
	return Number.isNaN(normalized.getTime())
		? new Date(0).toISOString()
		: normalized.toISOString();
}

function toNullableIsoString(value: Date | number | null): string | null {
	if (value === null) {
		return null;
	}

	const normalized = value instanceof Date ? value : new Date(value);
	return Number.isNaN(normalized.getTime()) ? null : normalized.toISOString();
}

function sumNullableNumbers(values: Array<number | null | undefined>): number | null {
	if (values.length === 0) {
		return null;
	}

	let total = 0;
	for (const value of values) {
		total += value ?? 0;
	}

	return total;
}

function averageNullableNumbers(values: Array<number | null | undefined>): number | null {
	if (values.length === 0) {
		return null;
	}

	const numericValues = values.filter((value): value is number => value !== null && value !== undefined);
	if (numericValues.length === 0) {
		return null;
	}

	return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function percentageChange(
	current: number | null,
	previous: number | null,
): number | null {
	if (current === null || previous === null || previous === 0) {
		return null;
	}

	return Number((((current - previous) / previous) * 100).toFixed(2));
}

function parseStrategySections(sectionsJson: string): {
	sectionCount: number;
	nonEmptySectionCount: number;
} {
	try {
		const parsed = JSON.parse(sectionsJson) as unknown;
		if (!Array.isArray(parsed)) {
			return { sectionCount: 0, nonEmptySectionCount: 0 };
		}

		const sectionCount = parsed.length;
		const nonEmptySectionCount = parsed.filter((section) => {
			if (!section || typeof section !== "object") {
				return false;
			}

			const content = (section as { content?: unknown }).content;
			return typeof content === "string" && content.trim().length > 0;
		}).length;

		return { sectionCount, nonEmptySectionCount };
	} catch {
		return { sectionCount: 0, nonEmptySectionCount: 0 };
	}
}

function hasNonEmptyValue(value: unknown): boolean {
	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	if (Array.isArray(value)) {
		return value.length > 0;
	}

	if (value && typeof value === "object") {
		return Object.keys(value).length > 0;
	}

	return value !== null && value !== undefined;
}

function parseReportSections(sectionsJson: string): {
	totalSections: number;
	filledSectionCount: number;
} {
	try {
		const parsed = JSON.parse(sectionsJson) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { totalSections: 0, filledSectionCount: 0 };
		}

		const entries = Object.entries(parsed as Record<string, unknown>);
		const filledSectionCount = entries.filter(([, value]) => {
			if (!value || typeof value !== "object" || Array.isArray(value)) {
				return hasNonEmptyValue(value);
			}

			const section = value as { adminNotes?: unknown; autoData?: unknown };
			return hasNonEmptyValue(section.adminNotes) || hasNonEmptyValue(section.autoData);
		}).length;

		return {
			totalSections: entries.length,
			filledSectionCount,
		};
	} catch {
		return { totalSections: 0, filledSectionCount: 0 };
	}
}

function normalizeArtifactStatus(
	status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null,
): "DRAFT" | "PUBLISHED" | "ARCHIVED" {
	if (status === "PUBLISHED" || status === "ARCHIVED") {
		return status;
	}

	return "DRAFT";
}

function buildDefaultPayload(clientId: string, generatedAt: string): ClientContextPayload {
	return {
		version: CLIENT_CONTEXT_VERSION,
		generatedAt,
		clientId,
		client: {
			name: null,
			domain: null,
			slug: null,
		},
		onboarding: {
			isOnboarded: false,
			profileVersion: null,
			status: null,
			completedAt: null,
			northStar: {
				statement: null,
				metricName: null,
				currentValue: null,
				targetValue: null,
				targetDate: null,
				timeHorizonMonths: null,
			},
			strategicLeversCount: 0,
			competitorsCount: 0,
		},
		kpis: {
			organicSessions30d: {
				current: null,
				previous: null,
				changePct: null,
				asOfDate: null,
			},
			totalClicks30d: {
				current: null,
				previous: null,
				changePct: null,
				asOfDate: null,
			},
			averagePosition30d: {
				current: null,
				previous: null,
				changePct: null,
				asOfDate: null,
			},
			domainAuthority: {
				current: null,
				asOfDate: null,
			},
			aiVisibilityOverall: {
				current: null,
				asOfDate: null,
			},
			health: {
				overallScore: null,
				status: null,
				reasons: [],
			},
		},
		activeArtifacts: {
			strategies: [],
			reports: [],
		},
		opportunities: {
			placeholder:
				"Module assistants can append prioritized opportunities after analysis.",
			items: [],
		},
		risks: {
			placeholder:
				"Module assistants can append risks and mitigations after analysis.",
			items: [],
		},
	};
}

async function defaultLoadClientRecord(clientId: string) {
	const row = await db
		.select({ name: clients.name, domain: clients.domain, slug: clients.slug })
		.from(clients)
		.where(eq(clients.id, clientId))
		.get();

	return row ?? null;
}

async function defaultLoadKpiData(clientId: string, now: Date): Promise<KpiRawData> {
	const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
	const str30 = toDateString(d30);
	const str60 = toDateString(d60);
	const strNow = toDateString(now);

	const [
		ga4Current,
		ga4Previous,
		gscCurrent,
		gscPrevious,
		mozLatest,
		aiVisibilityLatest,
	] = await Promise.all([
		db
			.select({ date: ga4Metrics.date, organicSessions: ga4Metrics.organicSessions })
			.from(ga4Metrics)
			.where(
				and(
					eq(ga4Metrics.clientId, clientId),
					gte(ga4Metrics.date, str30),
					lte(ga4Metrics.date, strNow),
				),
			)
			.all(),
		db
			.select({ date: ga4Metrics.date, organicSessions: ga4Metrics.organicSessions })
			.from(ga4Metrics)
			.where(
				and(
					eq(ga4Metrics.clientId, clientId),
					gte(ga4Metrics.date, str60),
					lte(ga4Metrics.date, str30),
				),
			)
			.all(),
		db
			.select({
				clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
				avgPosition: sql<number | null>`avg(${gscMetrics.position})`.as("avgPosition"),
			})
			.from(gscMetrics)
			.where(
				and(
					eq(gscMetrics.clientId, clientId),
					gte(gscMetrics.date, str30),
					lte(gscMetrics.date, strNow),
				),
			)
			.groupBy(gscMetrics.date)
			.all(),
		db
			.select({
				clicks: sql<number>`sum(${gscMetrics.clicks})`.as("clicks"),
				avgPosition: sql<number | null>`avg(${gscMetrics.position})`.as("avgPosition"),
			})
			.from(gscMetrics)
			.where(
				and(
					eq(gscMetrics.clientId, clientId),
					gte(gscMetrics.date, str60),
					lte(gscMetrics.date, str30),
				),
			)
			.groupBy(gscMetrics.date)
			.all(),
		db
			.select({ date: mozMetrics.date, domainAuthority: mozMetrics.domainAuthority })
			.from(mozMetrics)
			.where(eq(mozMetrics.clientId, clientId))
			.orderBy(desc(mozMetrics.date))
			.limit(1)
			.get(),
		db
			.select({ date: aiVisibility.date, overallScore: aiVisibility.overallScore })
			.from(aiVisibility)
			.where(eq(aiVisibility.clientId, clientId))
			.orderBy(desc(aiVisibility.date))
			.limit(1)
			.get(),
	]);

	return {
		ga4Current,
		ga4Previous,
		gscCurrent,
		gscPrevious,
		mozLatest: mozLatest
			? { date: mozLatest.date, domainAuthority: mozLatest.domainAuthority }
			: null,
		aiVisibilityLatest: aiVisibilityLatest
			? {
				date: aiVisibilityLatest.date,
				overallScore: aiVisibilityLatest.overallScore,
			}
			: null,
	};
}

async function defaultLoadActiveStrategies(
	clientId: string,
): Promise<StrategySummaryRow[]> {
	return db
		.select({
			id: seoStrategies.id,
			title: seoStrategies.title,
			status: seoStrategies.status,
			updatedAt: seoStrategies.updatedAt,
			publishedAt: seoStrategies.publishedAt,
			sections: seoStrategies.sections,
		})
		.from(seoStrategies)
		.where(and(eq(seoStrategies.clientId, clientId), ne(seoStrategies.status, "ARCHIVED")))
		.orderBy(desc(seoStrategies.updatedAt))
		.limit(3);
}

async function defaultLoadActiveReports(clientId: string): Promise<ReportSummaryRow[]> {
	return db
		.select({
			id: monthlyReports.id,
			title: monthlyReports.title,
			status: monthlyReports.status,
			month: monthlyReports.month,
			year: monthlyReports.year,
			updatedAt: monthlyReports.updatedAt,
			publishedAt: monthlyReports.publishedAt,
			sections: monthlyReports.sections,
		})
		.from(monthlyReports)
		.where(and(eq(monthlyReports.clientId, clientId), ne(monthlyReports.status, "ARCHIVED")))
		.orderBy(desc(monthlyReports.year), desc(monthlyReports.month), desc(monthlyReports.updatedAt))
		.limit(3);
}

async function defaultLoadKeywordOpportunities(
	clientId: string,
): Promise<OpportunityKeywordRow[]> {
	return db
		.select({
			id: keywordResearch.id,
			keyword: keywordResearch.keyword,
			priority: keywordResearch.priority,
			status: keywordResearch.status,
		})
		.from(keywordResearch)
		.where(
			and(
				eq(keywordResearch.clientId, clientId),
				eq(keywordResearch.status, "OPPORTUNITY"),
			),
		)
		.orderBy(desc(keywordResearch.updatedAt))
		.limit(5);
}

const defaultDependencies: ClientContextBuilderDependencies = {
	loadClientRecord: defaultLoadClientRecord,
	loadOnboardingProfile: getOnboardingProfile,
	loadHealthAggregate: getDashboardClientHealthAggregateByClientId,
	loadKpiData: defaultLoadKpiData,
	loadActiveStrategies: defaultLoadActiveStrategies,
	loadActiveReports: defaultLoadActiveReports,
	loadKeywordOpportunities: defaultLoadKeywordOpportunities,
};

async function safeDependency<T>(
	load: () => Promise<T>,
	fallback: T,
): Promise<T> {
	try {
		return await load();
	} catch {
		return fallback;
	}
}

function buildOpportunitySignals(
	keywords: OpportunityKeywordRow[],
	onboarding: OnboardingProfileResponse,
): Array<z.infer<typeof opportunitySignalSchema>> {
	const keywordSignals = keywords.map((keywordRow) => {
		const normalizedPriority = keywordRow.priority ?? "MEDIUM";
		const confidence: z.infer<typeof opportunitySignalSchema>["confidence"] =
			normalizedPriority === "HIGH"
				? "HIGH"
				: normalizedPriority === "LOW"
					? "LOW"
					: "MEDIUM";

		return {
			id: `keyword-${keywordRow.id}`,
			title: `Opportunity: ${keywordRow.keyword}`,
			description: `Priority ${normalizedPriority.toLowerCase()} keyword is currently in opportunity status.`,
			source: "KEYWORD" as const,
			confidence,
		};
	});

	if (onboarding.strategicLevers.length === 0) {
		return keywordSignals;
	}

	return [
		...keywordSignals,
		{
			id: "onboarding-strategic-levers",
			title: "Onboarding strategic levers ready for execution",
			description: `Client has ${onboarding.strategicLevers.length} strategic lever(s) configured.`,
			source: "ONBOARDING",
			confidence: "MEDIUM",
		},
	];
}

function buildRiskSignals(
	onboarding: OnboardingProfileResponse,
	healthAggregate: DashboardClientHealthAggregate | null,
): Array<z.infer<typeof riskSignalSchema>> {
	const signals: Array<z.infer<typeof riskSignalSchema>> = [];

	if (!onboarding.northStarGoal?.statement) {
		signals.push({
			id: "missing-north-star",
			title: "North Star goal is missing",
			description:
				"Onboarding does not currently include a North Star statement for this client.",
			source: "ONBOARDING",
			severity: "MEDIUM",
		});
	}

	if (!healthAggregate) {
		return signals;
	}

	const { health, aggregates } = healthAggregate;
	if (health.status === "CRITICAL") {
		signals.push({
			id: "critical-health-status",
			title: "Client health is critical",
			description: "Health score indicates critical status and requires immediate attention.",
			source: "HEALTH",
			severity: "HIGH",
		});
	}

	if (aggregates.technical.errorSources > 0) {
		signals.push({
			id: "source-sync-errors",
			title: "Connected data sources have sync errors",
			description: `${aggregates.technical.errorSources} source(s) report a sync error.`,
			source: "HEALTH",
			severity: "HIGH",
		});
	}

	if (aggregates.activeIssues.blockedTasks > 0) {
		signals.push({
			id: "blocked-tasks",
			title: "Blocked tasks are open",
			description: `${aggregates.activeIssues.blockedTasks} blocked task(s) are currently unresolved.`,
			source: "HEALTH",
			severity: "MEDIUM",
		});
	}

	return signals;
}

export async function buildClientContextPayload(
	clientId: string,
	options: ClientContextBuilderOptions = {},
): Promise<ClientContextPayload> {
	const now = options.now ?? new Date();
	const generatedAt = now.toISOString();
	const fallbackPayload = buildDefaultPayload(clientId, generatedAt);

	const dependencies: ClientContextBuilderDependencies = {
		...defaultDependencies,
		...options.dependencies,
	};

	const [
		clientRecord,
		onboardingProfile,
		healthAggregate,
		kpiData,
		activeStrategies,
		activeReports,
		keywordOpportunities,
	] = await Promise.all([
		safeDependency(() => dependencies.loadClientRecord(clientId), null),
		safeDependency(
			() => dependencies.loadOnboardingProfile(clientId),
			buildEmptyOnboardingProfile(clientId),
		),
		safeDependency(() => dependencies.loadHealthAggregate(clientId), null),
		safeDependency(() => dependencies.loadKpiData(clientId, now), {
			ga4Current: [],
			ga4Previous: [],
			gscCurrent: [],
			gscPrevious: [],
			mozLatest: null,
			aiVisibilityLatest: null,
		}),
		safeDependency(() => dependencies.loadActiveStrategies(clientId), []),
		safeDependency(() => dependencies.loadActiveReports(clientId), []),
		safeDependency(() => dependencies.loadKeywordOpportunities(clientId), []),
	]);

	const organicCurrent = sumNullableNumbers(
		kpiData.ga4Current.map((row) => row.organicSessions),
	);
	const organicPrevious = sumNullableNumbers(
		kpiData.ga4Previous.map((row) => row.organicSessions),
	);

	const clicksCurrent = sumNullableNumbers(kpiData.gscCurrent.map((row) => row.clicks));
	const clicksPrevious = sumNullableNumbers(kpiData.gscPrevious.map((row) => row.clicks));

	const avgPositionCurrent = averageNullableNumbers(
		kpiData.gscCurrent.map((row) => row.avgPosition),
	);
	const avgPositionPrevious = averageNullableNumbers(
		kpiData.gscPrevious.map((row) => row.avgPosition),
	);

	const opportunitySignals = buildOpportunitySignals(
		keywordOpportunities,
		onboardingProfile,
	);
	const riskSignals = buildRiskSignals(onboardingProfile, healthAggregate);

	const payload: ClientContextPayload = {
		version: CLIENT_CONTEXT_VERSION,
		generatedAt,
		clientId,
		client: {
			name: clientRecord?.name ?? null,
			domain: clientRecord?.domain ?? null,
			slug: clientRecord?.slug ?? null,
		},
		onboarding: {
			isOnboarded: onboardingProfile.profile !== null,
			profileVersion: onboardingProfile.profile?.version ?? null,
			status: onboardingProfile.profile?.status ?? null,
			completedAt: onboardingProfile.profile?.completedAt
				? onboardingProfile.profile.completedAt.toISOString()
				: null,
			northStar: {
				statement: onboardingProfile.northStarGoal?.statement ?? null,
				metricName: onboardingProfile.northStarGoal?.metricName ?? null,
				currentValue: onboardingProfile.northStarGoal?.currentValue ?? null,
				targetValue: onboardingProfile.northStarGoal?.targetValue ?? null,
				targetDate: onboardingProfile.northStarGoal?.targetDate ?? null,
				timeHorizonMonths:
					onboardingProfile.northStarGoal?.timeHorizonMonths ?? null,
			},
			strategicLeversCount: onboardingProfile.strategicLevers.length,
			competitorsCount: onboardingProfile.competitors.length,
		},
		kpis: {
			organicSessions30d: {
				current: organicCurrent,
				previous: organicPrevious,
				changePct: percentageChange(organicCurrent, organicPrevious),
				asOfDate: toDateString(now),
			},
			totalClicks30d: {
				current: clicksCurrent,
				previous: clicksPrevious,
				changePct: percentageChange(clicksCurrent, clicksPrevious),
				asOfDate: toDateString(now),
			},
			averagePosition30d: {
				current: avgPositionCurrent,
				previous: avgPositionPrevious,
				changePct: percentageChange(avgPositionCurrent, avgPositionPrevious),
				asOfDate: toDateString(now),
			},
			domainAuthority: {
				current: kpiData.mozLatest?.domainAuthority ?? null,
				asOfDate: kpiData.mozLatest?.date ?? null,
			},
			aiVisibilityOverall: {
				current: kpiData.aiVisibilityLatest?.overallScore ?? null,
				asOfDate: kpiData.aiVisibilityLatest?.date ?? null,
			},
			health: {
				overallScore: healthAggregate?.health.overallScore ?? null,
				status: healthAggregate?.health.status ?? null,
				reasons: healthAggregate?.health.reasons ?? [],
			},
		},
		activeArtifacts: {
			strategies: activeStrategies.map((strategy) => {
				const sectionStats = parseStrategySections(strategy.sections);
				return {
					id: strategy.id,
					title: strategy.title,
					status: normalizeArtifactStatus(strategy.status),
					updatedAt: toIsoString(strategy.updatedAt),
					publishedAt: toNullableIsoString(strategy.publishedAt),
					sectionCount: sectionStats.sectionCount,
					nonEmptySectionCount: sectionStats.nonEmptySectionCount,
				};
			}),
			reports: activeReports.map((report) => {
				const sectionStats = parseReportSections(report.sections);
				return {
					id: report.id,
					title: report.title,
					status: normalizeArtifactStatus(report.status),
					month: report.month,
					year: report.year,
					updatedAt: toIsoString(report.updatedAt),
					publishedAt: toNullableIsoString(report.publishedAt),
					totalSections: sectionStats.totalSections,
					filledSectionCount: sectionStats.filledSectionCount,
				};
			}),
		},
		opportunities: {
			placeholder:
				"Module assistants can append prioritized opportunities after analysis.",
			items: opportunitySignals,
		},
		risks: {
			placeholder:
				"Module assistants can append risks and mitigations after analysis.",
			items: riskSignals,
		},
	};

	const validationResult = clientContextPayloadSchema.safeParse(payload);
	if (validationResult.success) {
		return validationResult.data;
	}

	return fallbackPayload;
}
