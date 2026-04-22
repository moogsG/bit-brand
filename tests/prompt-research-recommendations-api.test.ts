import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));
vi.mock("@/lib/prompt-research/recommendations", () => ({
	buildPromptResearchRecommendations: vi.fn(),
}));

describe("prompt research recommendations API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_PROMPT_RESEARCH_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { buildPromptResearchRecommendations } = await import(
			"@/lib/prompt-research/recommendations"
		);

		vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(buildPromptResearchRecommendations).mockResolvedValue({
			version: "1.0.0",
			clientId: "client-1",
			windowDays: 90,
			startDate: "2026-01-15",
			promptSet: { id: "set-1", name: "Core Prompt Set" },
			totals: {
				totalPrompts: 10,
				uncoveredPrompts: 3,
				totalCitations: 40,
				uniqueDomains: 16,
			},
			recommendations: [
				{
					id: "close-prompt-coverage-gaps",
					title: "Close uncovered prompt intent gaps",
					priority: "HIGH",
					rationale: "3 prompts are uncovered.",
					action: "Map uncovered prompts.",
					evidence: { uncoveredPrompts: 3, uncoveredRate: 0.3 },
				},
			],
		} as any);
	});

	it.skip("returns 404 when feature flag is disabled", async () => {
		process.env.FF_PROMPT_RESEARCH_V1 = "false";

		const { GET } = await import(
			"@/app/api/ai/prompt-research/recommendations/route"
		);
		const request = new Request(
			"http://localhost/api/ai/prompt-research/recommendations?clientId=client-1",
		);

		const response = await GET(request as any);

		expect(response.status).toBe(404);
		const json = await response.json();
		expect(json.success).toBe(false);
		expect(json.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null);

		const { GET } = await import(
			"@/app/api/ai/prompt-research/recommendations/route"
		);
		const request = new Request(
			"http://localhost/api/ai/prompt-research/recommendations?clientId=client-1",
		);

		const response = await GET(request as any);

		expect(response.status).toBe(401);
		const json = await response.json();
		expect(json.error).toEqual({ code: "UNAUTHORIZED", message: "Unauthorized" });
	});

	it("returns 403 when user cannot access the client", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import(
			"@/app/api/ai/prompt-research/recommendations/route"
		);
		const request = new Request(
			"http://localhost/api/ai/prompt-research/recommendations?clientId=client-1",
		);

		const response = await GET(request as any);

		expect(response.status).toBe(403);
		const json = await response.json();
		expect(json.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns success envelope and passes validated query params to service", async () => {
		const { buildPromptResearchRecommendations } = await import(
			"@/lib/prompt-research/recommendations"
		);
		const { GET } = await import(
			"@/app/api/ai/prompt-research/recommendations/route"
		);
		const request = new Request(
			"http://localhost/api/ai/prompt-research/recommendations?clientId=client-1&promptSetId=set-1&window=90&limit=3",
		);

		const response = await GET(request as any);

		expect(response.status).toBe(200);
		expect(vi.mocked(buildPromptResearchRecommendations)).toHaveBeenCalledWith({
			clientId: "client-1",
			promptSetId: "set-1",
			windowDays: 90,
			limit: 3,
		});

		const json = await response.json();
		expect(json).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					clientId: "client-1",
					promptSet: { id: "set-1", name: "Core Prompt Set" },
					recommendations: [
						expect.objectContaining({
							id: "close-prompt-coverage-gaps",
							priority: "HIGH",
						}),
					],
				}),
			}),
		);
	});
});
