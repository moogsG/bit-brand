import { afterEach, describe, expect, it } from "vitest";
import { wordpressImplementationProvider } from "@/lib/implementation-agent/providers";

const baseProposal = {
	id: "proposal-1",
	proposalJson: JSON.stringify({
		targetRef: "https://example.com/blog/post",
		operation: "UPSERT",
	}),
} as any;

describe("wordpress implementation provider", () => {
	afterEach(() => {
		delete process.env.IMPLEMENTATION_WP_ALLOW_LIVE_WRITE;
		delete process.env.IMPLEMENTATION_WP_PROVIDER_MODE;
	});

	it("returns structured dry-run metadata without write attempts", async () => {
		const result = await wordpressImplementationProvider.execute({
			proposal: baseProposal,
			context: { dryRun: true },
		});

		expect(result.success).toBe(true);
		expect(result.output).toEqual(
			expect.objectContaining({
				provider: "wordpress",
				dryRun: true,
				writeAttempted: false,
				writeApplied: false,
				blockedReason: null,
				targetRef: "https://example.com/blog/post",
				operation: "UPSERT",
			}),
		);
	});

	it("blocks non-dry-run executions when live writes are not enabled", async () => {
		process.env.IMPLEMENTATION_WP_ALLOW_LIVE_WRITE = "false";

		const result = await wordpressImplementationProvider.execute({
			proposal: baseProposal,
			context: { dryRun: false },
		});

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/blocked/i);
		expect(result.output).toEqual(
			expect.objectContaining({
				provider: "wordpress",
				dryRun: false,
				writeAttempted: false,
				writeApplied: false,
				blockedReason: expect.any(String),
			}),
		);
	});
});
