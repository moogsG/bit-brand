import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
	can: vi.fn(),
}));

vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));

vi.mock("@/lib/eeat/service", () => ({
	getLatestEeatScoreForClient: vi.fn(),
	getEeatScoreTrendForClient: vi.fn(),
	parseFactorBreakdown: vi.fn(),
	parseRecommendations: vi.fn(),
}));

describe("eeat scores read API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_EEAT_SCORING_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const {
			getLatestEeatScoreForClient,
			getEeatScoreTrendForClient,
			parseFactorBreakdown,
			parseRecommendations,
		} = await import("@/lib/eeat/service");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "AGENCY_OWNER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});

		vi.mocked(getLatestEeatScoreForClient).mockResolvedValue({
			id: "score-1",
			responseId: "response-1",
			questionnaireId: "questionnaire-1",
			briefId: "brief-1",
			overallScore: 81.2,
			scoreVersion: "eeat-score-v1",
			factorBreakdown: '[{"key":"coverage"}]',
			recommendations: '["Do x"]',
			createdAt: new Date("2026-04-17T00:00:00.000Z"),
		} as any);

		vi.mocked(getEeatScoreTrendForClient).mockResolvedValue([
			{
				id: "score-1",
				responseId: "response-1",
				questionnaireId: "questionnaire-1",
				overallScore: 81.2,
				scoreVersion: "eeat-score-v1",
				createdAt: new Date("2026-04-17T00:00:00.000Z"),
			},
		]);

		vi.mocked(parseFactorBreakdown).mockReturnValue([
			{
				key: "coverage",
				label: "Coverage",
				score: 80,
				weight: 0.2,
			},
		] as any);
		vi.mocked(parseRecommendations).mockReturnValue([
			{
				title: "Increase optional coverage",
				rationale: "More context improves confidence",
				impact: "MEDIUM",
				effort: "LOW",
				moduleHint: "onboarding",
			},
		]);
	});

	it.skip("returns 404 when scoring flag is disabled", async () => {
		process.env.FF_EEAT_SCORING_V1 = "false";
		const { GET } = await import("@/app/api/eeat/[clientId]/route");

		const res = await GET(new Request("http://localhost/api/eeat/client-1"), {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(res.status).toBe(404);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/eeat/[clientId]/route");
		const res = await GET(new Request("http://localhost/api/eeat/client-1"), {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.error.code).toBe("UNAUTHORIZED");
	});

	it("returns 403 when access policy denies view", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/eeat/[clientId]/route");
		const res = await GET(new Request("http://localhost/api/eeat/client-1"), {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(res.status).toBe(403);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.error.code).toBe("FORBIDDEN");
	});

	it("returns success envelope with latest + trend payload", async () => {
		const { getEeatScoreTrendForClient } = await import("@/lib/eeat/service");
		const { GET } = await import("@/app/api/eeat/[clientId]/route");

		const res = await GET(
			new Request("http://localhost/api/eeat/client-1?limit=5"),
			{
				params: Promise.resolve({ clientId: "client-1" }),
			},
		);

		expect(res.status).toBe(200);
		const json = await res.json();

		expect(json).toMatchObject({
			version: "1.0.0",
			success: true,
			error: null,
			data: {
				clientId: "client-1",
				latest: {
					id: "score-1",
					responseId: "response-1",
					questionnaireId: "questionnaire-1",
					briefId: "brief-1",
					overallScore: 81.2,
					scoreVersion: "eeat-score-v1",
					factorBreakdown: [
						{
							key: "coverage",
							label: "Coverage",
							score: 80,
							weight: 0.2,
						},
					],
					recommendations: [
						{
							title: "Increase optional coverage",
							rationale: "More context improves confidence",
							impact: "MEDIUM",
							effort: "LOW",
							moduleHint: "onboarding",
						},
					],
				},
				trend: [
					{
						id: "score-1",
						responseId: "response-1",
						questionnaireId: "questionnaire-1",
						overallScore: 81.2,
						scoreVersion: "eeat-score-v1",
					},
				],
			},
		});

		expect(vi.mocked(getEeatScoreTrendForClient)).toHaveBeenCalledWith(
			"client-1",
			5,
		);
	});
});
