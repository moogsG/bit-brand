import type { OnboardingPersistInput, OnboardingProfileResponse } from "@/lib/onboarding";
import {
	businessFundamentalsSectionSchema,
	competitorItemSchema,
	conversionArchitectureSectionSchema,
	currentStateBaselineSectionSchema,
	northStarGoalSectionSchema,
	onboardingWizardDefaultValues,
	onboardingWizardSubmitSchema,
	strategicLeverItemSchema,
	type OnboardingWizardValues,
} from "./schemas";

function toNullableString(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: number | null | undefined) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitize(values: OnboardingWizardValues): OnboardingWizardValues {
	return {
		businessFundamentals: {
			businessName: values.businessFundamentals.businessName.trim(),
			domain: values.businessFundamentals.domain.trim(),
			industry: toNullableString(values.businessFundamentals.industry),
			targetGeo: toNullableString(values.businessFundamentals.targetGeo),
			primaryOffer: toNullableString(values.businessFundamentals.primaryOffer),
			idealCustomer: toNullableString(values.businessFundamentals.idealCustomer),
			pricingModel: toNullableString(values.businessFundamentals.pricingModel),
			salesCycleDays: normalizeNumber(values.businessFundamentals.salesCycleDays),
			notes: toNullableString(values.businessFundamentals.notes),
		},
		northStarGoal: {
			statement: values.northStarGoal.statement.trim(),
			metricName: toNullableString(values.northStarGoal.metricName),
			currentValue: normalizeNumber(values.northStarGoal.currentValue),
			targetValue: normalizeNumber(values.northStarGoal.targetValue),
			targetDate: toNullableString(values.northStarGoal.targetDate),
			timeHorizonMonths: normalizeNumber(values.northStarGoal.timeHorizonMonths),
			confidenceNotes: toNullableString(values.northStarGoal.confidenceNotes),
		},
		conversionArchitecture: {
			primaryConversion: values.conversionArchitecture.primaryConversion.trim(),
			secondaryConversions: values.conversionArchitecture.secondaryConversions
				.map((entry) => entry.trim())
				.filter(Boolean),
			leadCapturePoints: values.conversionArchitecture.leadCapturePoints
				.map((entry) => entry.trim())
				.filter(Boolean),
			crmPlatform: toNullableString(values.conversionArchitecture.crmPlatform),
			analyticsStack: toNullableString(values.conversionArchitecture.analyticsStack),
			attributionModel: toNullableString(values.conversionArchitecture.attributionModel),
		},
		strategicLevers: values.strategicLevers
			.map((lever) => ({
				lever: lever.lever.trim(),
				priority: lever.priority,
				ownerRole: toNullableString(lever.ownerRole),
				notes: toNullableString(lever.notes),
			}))
			.filter((lever) => lever.lever.length > 0),
		competitors: values.competitors
			.map((competitor) => ({
				name: competitor.name.trim(),
				domain: toNullableString(competitor.domain),
				positioning: toNullableString(competitor.positioning),
				strengths: toNullableString(competitor.strengths),
				weaknesses: toNullableString(competitor.weaknesses),
			}))
			.filter((competitor) => competitor.name.length > 0),
		currentStateBaseline: {
			monthlyOrganicSessions: normalizeNumber(
				values.currentStateBaseline.monthlyOrganicSessions,
			),
			monthlyLeads: normalizeNumber(values.currentStateBaseline.monthlyLeads),
			leadToCustomerRate: normalizeNumber(values.currentStateBaseline.leadToCustomerRate),
			closeRate: normalizeNumber(values.currentStateBaseline.closeRate),
			averageOrderValue: normalizeNumber(values.currentStateBaseline.averageOrderValue),
			customerLifetimeValue: normalizeNumber(
				values.currentStateBaseline.customerLifetimeValue,
			),
			notes: toNullableString(values.currentStateBaseline.notes),
		},
	};
}

function parseIfValid<T>(schema: { safeParse: (input: unknown) => { success: boolean; data?: T } }, value: unknown) {
	const result = schema.safeParse(value);
	return result.success ? result.data : undefined;
}

export function profileToWizardValues(
	profile: OnboardingProfileResponse,
): OnboardingWizardValues {
	const businessFundamentals = {
		...onboardingWizardDefaultValues.businessFundamentals,
		...(profile.businessFundamentals ?? {}),
	};

	const northStarGoal = {
		...onboardingWizardDefaultValues.northStarGoal,
		...(profile.northStarGoal ?? {}),
	};

	const conversionArchitecture = {
		...onboardingWizardDefaultValues.conversionArchitecture,
		...(profile.conversionArchitecture ?? {}),
		secondaryConversions:
			profile.conversionArchitecture?.secondaryConversions.length
				? profile.conversionArchitecture.secondaryConversions
				: [""],
		leadCapturePoints: profile.conversionArchitecture?.leadCapturePoints.length
			? profile.conversionArchitecture.leadCapturePoints
			: [""],
	};

	const strategicLevers =
		profile.strategicLevers.length > 0
			? profile.strategicLevers.map((lever) => ({
				lever: lever.lever,
				priority: lever.priority,
				ownerRole: lever.ownerRole ?? null,
				notes: lever.notes ?? null,
			}))
			: onboardingWizardDefaultValues.strategicLevers;

	const competitors =
		profile.competitors.length > 0
			? profile.competitors.map((competitor) => ({
				name: competitor.name,
				domain: competitor.domain ?? null,
				positioning: competitor.positioning ?? null,
				strengths: competitor.strengths ?? null,
				weaknesses: competitor.weaknesses ?? null,
			}))
			: onboardingWizardDefaultValues.competitors;

	const currentStateBaseline = {
		...onboardingWizardDefaultValues.currentStateBaseline,
		...(profile.currentStateBaseline ?? {}),
	};

	return {
		businessFundamentals,
		northStarGoal,
		conversionArchitecture,
		strategicLevers,
		competitors,
		currentStateBaseline,
	};
}

export function buildDraftPayload(
	values: OnboardingWizardValues,
	version?: number,
): OnboardingPersistInput {
	const normalized = sanitize(values);

	return {
		status: "DRAFT",
		version,
		businessFundamentals: parseIfValid(
			businessFundamentalsSectionSchema,
			normalized.businessFundamentals,
		),
		northStarGoal: parseIfValid(
			northStarGoalSectionSchema,
			normalized.northStarGoal,
		),
		conversionArchitecture: parseIfValid(
			conversionArchitectureSectionSchema,
			normalized.conversionArchitecture,
		),
		strategicLevers: normalized.strategicLevers
			.map((item) => parseIfValid(strategicLeverItemSchema, item))
			.filter((item): item is NonNullable<typeof item> => Boolean(item)),
		competitors: normalized.competitors
			.map((item) => parseIfValid(competitorItemSchema, item))
			.filter((item): item is NonNullable<typeof item> => Boolean(item)),
		currentStateBaseline: parseIfValid(
			currentStateBaselineSectionSchema,
			normalized.currentStateBaseline,
		),
	};
}

export function buildFinalPayload(
	values: OnboardingWizardValues,
	version?: number,
): OnboardingPersistInput {
	const normalized = sanitize(values);
	const parsed = onboardingWizardSubmitSchema.parse(normalized);

	return {
		status: "COMPLETED",
		version,
		businessFundamentals: parsed.businessFundamentals,
		northStarGoal: parsed.northStarGoal,
		conversionArchitecture: parsed.conversionArchitecture,
		strategicLevers: parsed.strategicLevers,
		competitors: parsed.competitors,
		currentStateBaseline: parsed.currentStateBaseline,
	};
}
