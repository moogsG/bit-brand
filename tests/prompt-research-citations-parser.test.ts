import { describe, expect, it } from "vitest";
import {
	extractDomainsAndUrls,
	inferContentType,
	normalizeDomain,
	parseCitationCandidates,
} from "@/lib/prompt-research/citations";

describe("prompt research citation parsing", () => {
	it("normalizes domains", () => {
		expect(normalizeDomain("https://WWW.Example.com/some/page"))
			.toBe("example.com");
		expect(normalizeDomain("example.com:443"))
			.toBe("example.com");
	});

	it("extracts domains and urls deterministically", () => {
		const text =
			"See https://example.com/blog/post and also www.test.com plus https://example.com/blog/post";
		const extracted = extractDomainsAndUrls(text);
		expect(extracted.find((x) => x.domain === "example.com")?.url).toContain(
			"https://example.com",
		);
		expect(extracted.some((x) => x.domain === "test.com")).toBe(true);
	});

	it("infers content types", () => {
		expect(inferContentType("https://youtube.com/watch?v=1", "youtube.com")).toBe(
			"VIDEO",
		);
		expect(inferContentType("https://example.com/docs/start", "example.com")).toBe(
			"DOCS",
		);
	});

	it("parses citation candidates from run result fields", () => {
		const c = parseCitationCandidates({
			citationDomain: "example.com",
			responseSnippet: "Answer cites https://example.com/blog/post",
			citationSnippet: null,
		});
		expect(c.some((x) => x.domain === "example.com")).toBe(true);
	});
});
