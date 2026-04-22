import { z } from "zod";

export const onboardingPrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const onboardingStatusSchema = z.enum(["DRAFT", "COMPLETED"]);

export const businessFundamentalsInputSchema = z.object({
	businessName: z.string().min(1),
	domain: z.string().min(1),
	industry: z.string().nullable().optional(),
	targetGeo: z.string().nullable().optional(),
	primaryOffer: z.string().nullable().optional(),
	idealCustomer: z.string().nullable().optional(),
	pricingModel: z.string().nullable().optional(),
	salesCycleDays: z.number().int().nonnegative().nullable().optional(),
	notes: z.string().nullable().optional(),
});

export const northStarGoalInputSchema = z.object({
	statement: z.string().min(1),
	metricName: z.string().nullable().optional(),
	currentValue: z.number().nullable().optional(),
	targetValue: z.number().nullable().optional(),
	targetDate: z.string().nullable().optional(),
	timeHorizonMonths: z.number().int().positive().nullable().optional(),
	confidenceNotes: z.string().nullable().optional(),
});

export const conversionArchitectureInputSchema = z.object({
	primaryConversion: z.string().min(1),
	secondaryConversions: z.array(z.string().min(1)).default([]),
	leadCapturePoints: z.array(z.string().min(1)).default([]),
	crmPlatform: z.string().nullable().optional(),
	analyticsStack: z.string().nullable().optional(),
	attributionModel: z.string().nullable().optional(),
});

export const strategicLeverInputSchema = z.object({
	lever: z.string().min(1),
	priority: onboardingPrioritySchema.default("MEDIUM"),
	ownerRole: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
});

export const competitorInputSchema = z.object({
	name: z.string().min(1),
	domain: z.string().nullable().optional(),
	positioning: z.string().nullable().optional(),
	strengths: z.string().nullable().optional(),
	weaknesses: z.string().nullable().optional(),
});

export const currentStateBaselineInputSchema = z.object({
	monthlyOrganicSessions: z.number().int().nonnegative().nullable().optional(),
	monthlyLeads: z.number().int().nonnegative().nullable().optional(),
	leadToCustomerRate: z.number().nullable().optional(),
	closeRate: z.number().nullable().optional(),
	averageOrderValue: z.number().nullable().optional(),
	customerLifetimeValue: z.number().nullable().optional(),
	notes: z.string().nullable().optional(),
});

export const onboardingProfileInputSchema = z.object({
	status: onboardingStatusSchema.optional(),
	businessFundamentals: businessFundamentalsInputSchema.optional(),
	northStarGoal: northStarGoalInputSchema.optional(),
	conversionArchitecture: conversionArchitectureInputSchema.optional(),
	strategicLevers: z.array(strategicLeverInputSchema).optional(),
	competitors: z.array(competitorInputSchema).optional(),
	currentStateBaseline: currentStateBaselineInputSchema.optional(),
});

export const onboardingPersistSchema = onboardingProfileInputSchema.extend({
	createNewVersion: z.boolean().optional(),
	version: z.number().int().positive().optional(),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileInputSchema>;
export type OnboardingPersistInput = z.infer<typeof onboardingPersistSchema>;

export interface OnboardingProfileHeader {
	id: string;
	version: number;
	status: "DRAFT" | "COMPLETED";
	completedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface OnboardingProfileResponse {
	clientId: string;
	profile: OnboardingProfileHeader | null;
	businessFundamentals: z.infer<typeof businessFundamentalsInputSchema> | null;
	northStarGoal: z.infer<typeof northStarGoalInputSchema> | null;
	conversionArchitecture: z.infer<typeof conversionArchitectureInputSchema> | null;
	strategicLevers: z.infer<typeof strategicLeverInputSchema>[];
	competitors: z.infer<typeof competitorInputSchema>[];
	currentStateBaseline: z.infer<typeof currentStateBaselineInputSchema> | null;
}

export function buildEmptyOnboardingProfile(
	clientId: string,
): OnboardingProfileResponse {
	return {
		clientId,
		profile: null,
		businessFundamentals: null,
		northStarGoal: null,
		conversionArchitecture: null,
		strategicLevers: [],
		competitors: [],
		currentStateBaseline: null,
	};
}
