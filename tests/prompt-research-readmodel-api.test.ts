import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));
vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		all: vi.fn(),
		get: vi.fn(),
	},
}));

describe("prompt research read model API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_PROMPT_RESEARCH_V1 = "true";
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

	it("returns 404 when feature disabled", async () => {
		process.env.FF_PROMPT_RESEARCH_V1 = "false";
		const { GET } = await import("@/app/api/ai/prompt-research/[clientId]/route");
		const req = new Request(
			"http://localhost/api/ai/prompt-research/client-1?window=30",
		);
		const res = await GET(req as any, { params: Promise.resolve({ clientId: "client-1" }) });
		expect(res.status).toBe(404);
	});

	it("returns read model shape", async () => {
		const { db } = await import("@/lib/db");
		const dbAny = db as any;
		// prompt set
		dbAny.get.mockResolvedValueOnce({ id: "set-1", clientId: "client-1", name: "Active" });
		// citations
		dbAny.all
			.mockResolvedValueOnce([
				{ domain: "example.com", engine: "CHATGPT", contentType: "ARTICLE", date: "2026-04-02" },
			])
			// prompts
			.mockResolvedValueOnce([
				{ id: "p1", text: "same day delivery florist sydney", isActive: true },
			])
			// keywords
			.mockResolvedValueOnce([
				{ id: "k1", keyword: "same day delivery florist sydney", targetUrl: "https://x/y" },
			]);

		const { GET } = await import("@/app/api/ai/prompt-research/[clientId]/route");
		const req = new Request(
			"http://localhost/api/ai/prompt-research/client-1?window=30",
		);
		const res = await GET(req as any, { params: Promise.resolve({ clientId: "client-1" }) });
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.promptSet.id).toBe("set-1");
		expect(json.data.coverage.covered.length + json.data.coverage.uncovered.length).toBe(1);
		expect(json.data.topDomains[0].domain).toBe("example.com");
	});
});
