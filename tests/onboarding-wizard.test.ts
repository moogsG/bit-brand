import { describe, expect, it } from "vitest";
import {
	buildDraftPayload,
	buildFinalPayload,
	profileToWizardValues,
} from "@/components/admin/onboarding/payload";
import {
	onboardingWizardDefaultValues,
	onboardingWizardSubmitSchema,
} from "@/components/admin/onboarding/schemas";

describe("onboarding wizard payload helpers", () => {
	it("maps API profile values into wizard defaults", () => {
		const mapped = profileToWizardValues({
			clientId: "client-1",
			profile: null,
			businessFundamentals: null,
			northStarGoal: null,
			conversionArchitecture: null,
			strategicLevers: [],
			competitors: [],
			currentStateBaseline: null,
		});

		expect(mapped).toEqual(onboardingWizardDefaultValues);
	});

	it("builds draft payload with only valid sections", () => {
		const payload = buildDraftPayload(
			{
				...onboardingWizardDefaultValues,
				businessFundamentals: {
					...onboardingWizardDefaultValues.businessFundamentals,
					businessName: "Acme Corp",
					domain: "acme.com",
				},
				strategicLevers: [{ ...onboardingWizardDefaultValues.strategicLevers[0] }],
				competitors: [{ ...onboardingWizardDefaultValues.competitors[0] }],
			},
			2,
		);

		expect(payload.status).toBe("DRAFT");
		expect(payload.version).toBe(2);
		expect(payload.businessFundamentals).toBeTruthy();
		expect(payload.strategicLevers).toEqual([]);
		expect(payload.competitors).toEqual([]);
	});

	it("builds final payload as completed profile", () => {
		const valid = onboardingWizardSubmitSchema.parse({
			businessFundamentals: {
				businessName: "Acme Corp",
				domain: "acme.com",
				industry: null,
				targetGeo: "United States",
				primaryOffer: null,
				idealCustomer: null,
				pricingModel: null,
				salesCycleDays: 30,
				notes: null,
			},
			northStarGoal: {
				statement: "Grow SQL pipeline",
				metricName: "SQLs",
				currentValue: 50,
				targetValue: 120,
				targetDate: "2026-12-31",
				timeHorizonMonths: 12,
				confidenceNotes: null,
			},
			conversionArchitecture: {
				primaryConversion: "Demo booked",
				secondaryConversions: ["Newsletter signup"],
				leadCapturePoints: ["Contact page"],
				crmPlatform: "HubSpot",
				analyticsStack: "GA4 + GSC",
				attributionModel: "Last click",
			},
			strategicLevers: [
				{ lever: "Programmatic landing pages", priority: "HIGH", ownerRole: null, notes: null },
			],
			competitors: [
				{ name: "Example Co", domain: "example.com", positioning: null, strengths: null, weaknesses: null },
			],
			currentStateBaseline: {
				monthlyOrganicSessions: 15000,
				monthlyLeads: 140,
				leadToCustomerRate: 0.22,
				closeRate: 0.3,
				averageOrderValue: 1200,
				customerLifetimeValue: 5400,
				notes: null,
			},
		});

		const payload = buildFinalPayload(valid, 3);

		expect(payload.status).toBe("COMPLETED");
		expect(payload.version).toBe(3);
		expect(payload.businessFundamentals?.businessName).toBe("Acme Corp");
		expect(payload.strategicLevers).toHaveLength(1);
		expect(payload.competitors).toHaveLength(1);
	});
});
