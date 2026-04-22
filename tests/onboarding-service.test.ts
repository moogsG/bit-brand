import { describe, expect, it } from "vitest";
import {
	buildEmptyOnboardingProfile,
	onboardingPersistSchema,
} from "@/lib/onboarding";

describe("onboarding service types", () => {
	it("returns backward-compatible empty onboarding shape", () => {
		const profile = buildEmptyOnboardingProfile("client-123");

		expect(profile.clientId).toBe("client-123");
		expect(profile.profile).toBeNull();
		expect(profile.businessFundamentals).toBeNull();
		expect(profile.northStarGoal).toBeNull();
		expect(profile.conversionArchitecture).toBeNull();
		expect(profile.strategicLevers).toEqual([]);
		expect(profile.competitors).toEqual([]);
		expect(profile.currentStateBaseline).toBeNull();
	});

	it("applies defaults for conversion architecture arrays", () => {
		const parsed = onboardingPersistSchema.parse({
			conversionArchitecture: {
				primaryConversion: "Qualified lead",
			},
		});

		expect(parsed.conversionArchitecture?.secondaryConversions).toEqual([]);
		expect(parsed.conversionArchitecture?.leadCapturePoints).toEqual([]);
	});
});
