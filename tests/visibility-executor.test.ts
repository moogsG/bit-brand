import { describe, expect, it } from "vitest";
import {
	executeVisibilityPrompt,
	getVisibilityExecutorMode,
} from "@/lib/ai/visibility-executor";

describe("visibility executor adapter", () => {
	it("defaults to placeholder mode", () => {
		expect(getVisibilityExecutorMode({})).toBe("placeholder");
	});

	it("returns deterministic placeholder output", () => {
		const first = executeVisibilityPrompt(
			{ engine: "CHATGPT", promptText: "best seo agency in austin" },
			{ AI_VISIBILITY_EXECUTOR_MODE: "placeholder" },
		);
		const second = executeVisibilityPrompt(
			{ engine: "CHATGPT", promptText: "best seo agency in austin" },
			{ AI_VISIBILITY_EXECUTOR_MODE: "placeholder" },
		);

		expect(first.isVisible).toBe(second.isVisible);
		expect(first.position).toBe(second.position);
		expect(first.metadata.effectiveMode).toBe("placeholder");
		expect(first.metadata.usedFallback).toBe(false);
	});

	it("falls back to placeholder when provider mode is missing creds", () => {
		const output = executeVisibilityPrompt(
			{ engine: "GEMINI", promptText: "top local seo consultants" },
			{ AI_VISIBILITY_EXECUTOR_MODE: "provider" },
		);

		expect(output.metadata.requestedMode).toBe("provider");
		expect(output.metadata.effectiveMode).toBe("placeholder");
		expect(output.metadata.usedFallback).toBe(true);
		expect(output.metadata.fallbackReason).toContain("Provider mode requested");
	});

	it("uses provider-stub mode when provider env is configured", () => {
		const output = executeVisibilityPrompt(
			{ engine: "PERPLEXITY", promptText: "ai seo tools for agencies" },
			{
				AI_VISIBILITY_EXECUTOR_MODE: "provider",
				AI_VISIBILITY_PROVIDER_NAME: "mock-provider",
				AI_VISIBILITY_PROVIDER_API_KEY: "test-key",
			},
		);

		expect(output.metadata.requestedMode).toBe("provider");
		expect(output.metadata.effectiveMode).toBe("provider");
		expect(output.metadata.source).toBe("provider-stub");
		expect(output.metadata.usedFallback).toBe(false);
	});
});
