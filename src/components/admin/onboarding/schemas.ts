import { z } from "zod";

const nullableText = z
	.string()
	.trim()
	.transform((value) => (value.length === 0 ? null : value))
	.nullable();

const optionalNumber = z.number().finite().nullable();

export const businessFundamentalsSectionSchema = z.object({
	businessName: z.string().trim().min(1, "Business name is required"),
	domain: z.string().trim().min(1, "Domain is required"),
	industry: nullableText,
	targetGeo: nullableText,
	primaryOffer: nullableText,
	idealCustomer: nullableText,
	pricingModel: nullableText,
	salesCycleDays: z
		.number()
		.int("Sales cycle must be a whole number")
		.nonnegative("Sales cycle cannot be negative")
		.nullable(),
	notes: nullableText,
});

export const northStarGoalSectionSchema = z.object({
	statement: z.string().trim().min(1, "North Star statement is required"),
	metricName: nullableText,
	currentValue: optionalNumber,
	targetValue: optionalNumber,
	targetDate: nullableText,
	timeHorizonMonths: z
		.number()
		.int("Time horizon must be a whole number")
		.positive("Time horizon must be greater than zero")
		.nullable(),
	confidenceNotes: nullableText,
});

export const conversionArchitectureSectionSchema = z.object({
	primaryConversion: z
		.string()
		.trim()
		.min(1, "Primary conversion is required"),
	secondaryConversions: z.array(z.string().trim().min(1)).default([]),
	leadCapturePoints: z.array(z.string().trim().min(1)).default([]),
	crmPlatform: nullableText,
	analyticsStack: nullableText,
	attributionModel: nullableText,
});

export const strategicLeverItemSchema = z.object({
	lever: z.string().trim().min(1, "Lever name is required"),
	priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
	ownerRole: nullableText,
	notes: nullableText,
});

export const strategicLeversSectionSchema = z
	.array(strategicLeverItemSchema)
	.min(1, "Add at least one strategic lever");

export const competitorItemSchema = z.object({
	name: z.string().trim().min(1, "Competitor name is required"),
	domain: nullableText,
	positioning: nullableText,
	strengths: nullableText,
	weaknesses: nullableText,
});

export const competitorsSectionSchema = z
	.array(competitorItemSchema)
	.min(1, "Add at least one competitor");

export const currentStateBaselineSectionSchema = z.object({
	monthlyOrganicSessions: z
		.number()
		.int("Organic sessions must be a whole number")
		.nonnegative("Organic sessions cannot be negative")
		.nullable(),
	monthlyLeads: z
		.number()
		.int("Monthly leads must be a whole number")
		.nonnegative("Monthly leads cannot be negative")
		.nullable(),
	leadToCustomerRate: optionalNumber,
	closeRate: optionalNumber,
	averageOrderValue: optionalNumber,
	customerLifetimeValue: optionalNumber,
	notes: nullableText,
});

export const onboardingWizardSubmitSchema = z.object({
	businessFundamentals: businessFundamentalsSectionSchema,
	northStarGoal: northStarGoalSectionSchema,
	conversionArchitecture: conversionArchitectureSectionSchema,
	strategicLevers: strategicLeversSectionSchema,
	competitors: competitorsSectionSchema,
	currentStateBaseline: currentStateBaselineSectionSchema,
});

export const onboardingWizardDraftSchema = onboardingWizardSubmitSchema.partial();

export type OnboardingWizardValues = z.infer<typeof onboardingWizardSubmitSchema>;

export const onboardingWizardDefaultValues: OnboardingWizardValues = {
	businessFundamentals: {
		businessName: "",
		domain: "",
		industry: null,
		targetGeo: null,
		primaryOffer: null,
		idealCustomer: null,
		pricingModel: null,
		salesCycleDays: null,
		notes: null,
	},
	northStarGoal: {
		statement: "",
		metricName: null,
		currentValue: null,
		targetValue: null,
		targetDate: null,
		timeHorizonMonths: null,
		confidenceNotes: null,
	},
	conversionArchitecture: {
		primaryConversion: "",
		secondaryConversions: [""],
		leadCapturePoints: [""],
		crmPlatform: null,
		analyticsStack: null,
		attributionModel: null,
	},
	strategicLevers: [
		{
			lever: "",
			priority: "MEDIUM",
			ownerRole: null,
			notes: null,
		},
	],
	competitors: [
		{
			name: "",
			domain: null,
			positioning: null,
			strengths: null,
			weaknesses: null,
		},
	],
	currentStateBaseline: {
		monthlyOrganicSessions: null,
		monthlyLeads: null,
		leadToCustomerRate: null,
		closeRate: null,
		averageOrderValue: null,
		customerLifetimeValue: null,
		notes: null,
	},
};
