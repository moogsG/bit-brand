import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
	can: vi.fn(),
}));

vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));

vi.mock("@/lib/technical/baseline-audit", () => ({
	runTechnicalBaselineAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		get: vi.fn(),
		all: vi.fn(),
	},
}));

describe("technical audits API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_BASELINE_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(db.get).mockResolvedValue({
			id: "client-1",
			domain: "example.com",
			isActive: true,
		} as any);
		vi.mocked(db.all).mockResolvedValue([] as any);
	});

	it("GET returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/technical/audits/route");
		const request = new NextRequest(
			"http://localhost:3000/api/technical/audits?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toEqual({ code: "UNAUTHORIZED", message: "Unauthorized" });
	});

	it.skip("GET returns 404 when feature flag is disabled", async () => {
		process.env.FF_TECHNICAL_BASELINE_V1 = "false";

		const { GET } = await import("@/app/api/technical/audits/route");
		const request = new NextRequest(
			"http://localhost:3000/api/technical/audits?clientId=client-1",
		);

		const response = await GET(request as any);
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error.code).toBe("FEATURE_DISABLED");
	});

	it("POST returns 400 for invalid JSON body", async () => {
		const { runTechnicalBaselineAudit } = await import("@/lib/technical/baseline-audit");
		const { POST } = await import("@/app/api/technical/audits/route");

		const request = new Request("http://localhost:3000/api/technical/audits", {
			method: "POST",
			body: "{",
			headers: {
				"content-type": "application/json",
			},
		});

		const response = await POST(request as any);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBe("Request body must be valid JSON");
		expect(vi.mocked(runTechnicalBaselineAudit)).not.toHaveBeenCalled();
	});

	it("GET includes technical issue priority and proposable fields", async () => {
		const { db } = await import("@/lib/db");
		const { GET } = await import("@/app/api/technical/audits/route");

		vi.mocked(db.all)
			.mockResolvedValueOnce([
				{
					id: "run-1",
					clientId: "client-1",
					status: "SUCCESS",
					seedUrls: "[\"https://example.com/\"]",
					pagesCrawled: 1,
					issuesFound: 1,
					error: null,
					startedAt: "2026-04-01T00:00:00.000Z",
					completedAt: "2026-04-01T00:01:00.000Z",
					createdAt: "2026-04-01T00:00:00.000Z",
				},
			] as any)
			.mockResolvedValueOnce([
				{
					id: "issue-1",
					runId: "run-1",
					clientId: "client-1",
					url: "https://example.com/a",
					issueType: "BROKEN_LINK",
					severity: "CRITICAL",
					message: "Broken link",
					details: "{}",
					priorityScore: 92,
					priorityBand: "URGENT",
					proposable: true,
					proposableRationale: "Critical severity baseline applied",
					createdAt: "2026-04-01T00:00:00.000Z",
				},
			] as any);

		const request = new NextRequest(
			"http://localhost:3000/api/technical/audits?clientId=client-1",
		);
		const response = await GET(request as any);
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.data.runs[0].issues[0]).toEqual(
			expect.objectContaining({
				priorityScore: 92,
				priorityBand: "URGENT",
				proposable: true,
				proposableRationale: "Critical severity baseline applied",
			}),
		);
	});

	it("POST returns 400 for schema validation errors", async () => {
		const { runTechnicalBaselineAudit } = await import("@/lib/technical/baseline-audit");
		const { POST } = await import("@/app/api/technical/audits/route");

		const request = new Request("http://localhost:3000/api/technical/audits", {
			method: "POST",
			body: JSON.stringify({ clientId: "", urls: ["https://example.com"] }),
		});

		const response = await POST(request as any);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBe("Invalid request body");
		expect(vi.mocked(runTechnicalBaselineAudit)).not.toHaveBeenCalled();
	});

	it.skip("POST returns 404 when feature flag is disabled", async () => {
		process.env.FF_TECHNICAL_BASELINE_V1 = "false";

		const { runTechnicalBaselineAudit } = await import("@/lib/technical/baseline-audit");
		const { POST } = await import("@/app/api/technical/audits/route");
		const request = new Request("http://localhost:3000/api/technical/audits", {
			method: "POST",
			body: JSON.stringify({ clientId: "client-1" }),
		});

		const response = await POST(request as any);
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error.code).toBe("FEATURE_DISABLED");
		expect(vi.mocked(runTechnicalBaselineAudit)).not.toHaveBeenCalled();
	});
});
