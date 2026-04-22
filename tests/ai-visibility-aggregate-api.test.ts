import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));
vi.mock("@/lib/ai/visibility-aggregate", () => ({
	getAiVisibilityAggregateSeries: vi.fn(),
}));

describe("ai visibility aggregate API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_AI_VISIBILITY_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");

		vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it.skip("returns 404 when module disabled", async () => {
		process.env.FF_AI_VISIBILITY_V1 = "false";
		const { GET } = await import("@/app/api/ai/visibility/aggregate/route");
		const req = new Request(
			"http://localhost/api/ai/visibility/aggregate?clientId=client-1&window=30",
		);
		const res = await GET(req as any);
		expect(res.status).toBe(404);
	});

	it("returns latest + series", async () => {
		const { getAiVisibilityAggregateSeries } = await import(
			"@/lib/ai/visibility-aggregate"
		);
		vi.mocked(getAiVisibilityAggregateSeries as any).mockResolvedValueOnce([
			{ date: "2026-04-01", overallScore: 10, totalPromptsTested: 10, promptsVisible: 1 },
			{ date: "2026-04-02", overallScore: 20, totalPromptsTested: 10, promptsVisible: 2 },
		]);

		const { GET } = await import("@/app/api/ai/visibility/aggregate/route");
		const req = new Request(
			"http://localhost/api/ai/visibility/aggregate?clientId=client-1&window=30",
		);
		const res = await GET(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.latest.date).toBe("2026-04-02");
		expect(json.data.series).toHaveLength(2);
	});
});
