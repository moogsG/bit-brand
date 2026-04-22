import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NorthStarRibbonView } from "@/components/shared/north-star-ribbon";

describe("NorthStarRibbonView", () => {
	it("renders onboarding empty state when no north star goal exists", () => {
		const html = renderToStaticMarkup(
			createElement(NorthStarRibbonView, {
				summary: {
					statement: null,
					metricName: null,
					currentValue: null,
					targetValue: null,
					targetDate: null,
					status: null,
				},
				onboardingHref: "/admin/clients/client-1/onboarding",
			}),
		);

		expect(html).toContain("North Star not set");
		expect(html).toContain("This client has not completed onboarding yet.");
		expect(html).toContain("Set North Star");
	});

	it("renders goal and progress summary when north star exists", () => {
		const html = renderToStaticMarkup(
			createElement(NorthStarRibbonView, {
				summary: {
					statement: "Increase qualified pipeline",
					metricName: "Qualified leads",
					currentValue: 32,
					targetValue: 80,
					targetDate: "2026-12-31",
					status: "COMPLETED",
				},
			}),
		);

		expect(html).toContain("North Star");
		expect(html).toContain("Increase qualified pipeline");
		expect(html).toContain("Qualified leads");
		expect(html).toContain("40%");
		expect(html).toContain("Onboarding complete");
	});
});
