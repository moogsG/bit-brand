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

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
	},
}));

vi.mock("@/lib/onboarding", () => ({
	getOnboardingProfile: vi.fn(),
	saveOnboardingProfile: vi.fn(),
	onboardingPersistSchema: {
		parse: vi.fn((value) => value),
	},
}));

describe("onboarding API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_ONBOARDING_V2 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { db } = await import("@/lib/db");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { getOnboardingProfile, saveOnboardingProfile } = await import(
			"@/lib/onboarding"
		);

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", email: "admin@test.com" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: [],
		});
		vi.mocked(db.get).mockReturnValue({ id: "client-1" });
		vi.mocked(getOnboardingProfile).mockResolvedValue({
			clientId: "client-1",
			profile: null,
			businessFundamentals: null,
			northStarGoal: null,
			conversionArchitecture: null,
			strategicLevers: [],
			competitors: [],
			currentStateBaseline: null,
		});
		vi.mocked(saveOnboardingProfile).mockResolvedValue({
			clientId: "client-1",
			profile: {
				id: "profile-1",
				version: 1,
				status: "DRAFT",
				completedAt: null,
				createdAt: new Date("2026-01-01T00:00:00Z"),
				updatedAt: new Date("2026-01-01T00:00:00Z"),
			},
			businessFundamentals: {
				businessName: "Acme Corp",
				domain: "acme.com",
			},
			northStarGoal: null,
			conversionArchitecture: null,
			strategicLevers: [],
			competitors: [],
			currentStateBaseline: null,
		} as any);
	});

	it.skip("returns 404 when onboarding v2 flag is disabled", async () => {
		process.env.FF_ONBOARDING_V2 = "false";

		const { GET } = await import("@/app/api/onboarding/[clientId]/route");
		const request = new Request("http://localhost:3000/api/onboarding/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(404);
		const payload = await response.json();
		expect(payload.error).toContain("disabled");
	});

	it.skip("returns 404 on PUT when onboarding v2 flag is disabled", async () => {
		process.env.FF_ONBOARDING_V2 = "false";

		const { PUT } = await import("@/app/api/onboarding/[clientId]/route");
		const request = new Request("http://localhost:3000/api/onboarding/client-1", {
			method: "PUT",
			body: JSON.stringify({ status: "DRAFT" }),
		});
		const response = await PUT(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(404);
		const payload = await response.json();
		expect(payload.error).toContain("disabled");
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth as any).mockResolvedValueOnce(null);

		const { GET } = await import("@/app/api/onboarding/[clientId]/route");
		const request = new Request("http://localhost:3000/api/onboarding/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 403 when user cannot view onboarding", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/onboarding/[clientId]/route");
		const request = new Request("http://localhost:3000/api/onboarding/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(403);
	});

	it("returns onboarding profile shape on GET", async () => {
		const { GET } = await import("@/app/api/onboarding/[clientId]/route");
		const { can } = await import("@/lib/auth/authorize");
		const request = new Request("http://localhost:3000/api/onboarding/client-1");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toHaveProperty("clientId", "client-1");
		expect(data).toHaveProperty("strategicLevers");
		expect(Array.isArray(data.strategicLevers)).toBe(true);
		expect(can).toHaveBeenCalledWith(
			"onboarding",
			"view",
			expect.objectContaining({
				clientId: "client-1",
				assignedClientIds: [],
				isClientMember: false,
			}),
		);
	});

	it("returns 404 when client does not exist", async () => {
		const { db } = await import("@/lib/db");
		vi.mocked(db.get).mockReturnValueOnce(undefined);

		const { GET } = await import("@/app/api/onboarding/[clientId]/route");
		const request = new Request("http://localhost:3000/api/onboarding/client-missing");
		const response = await GET(request as any, {
			params: Promise.resolve({ clientId: "client-missing" }),
		});

		expect(response.status).toBe(404);
		const payload = await response.json();
		expect(payload.error).toBe("Client not found");
	});

	it("returns 403 when user cannot edit onboarding", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { PUT } = await import("@/app/api/onboarding/[clientId]/route");
		const request = new Request("http://localhost:3000/api/onboarding/client-1", {
			method: "PUT",
			body: JSON.stringify({
				businessFundamentals: { businessName: "Acme", domain: "acme.com" },
			}),
		});
		const response = await PUT(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(403);
	});

	it("persists onboarding profile on PUT", async () => {
		const { saveOnboardingProfile } = await import("@/lib/onboarding");
		const { PUT } = await import("@/app/api/onboarding/[clientId]/route");

		const request = new Request("http://localhost:3000/api/onboarding/client-1", {
			method: "PUT",
			body: JSON.stringify({
				status: "DRAFT",
				createNewVersion: true,
				businessFundamentals: {
					businessName: "Acme Corp",
					domain: "acme.com",
				},
			}),
		});

		const response = await PUT(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(200);
		expect(saveOnboardingProfile).toHaveBeenCalledWith(
			"client-1",
			"user-1",
			expect.objectContaining({
				status: "DRAFT",
				businessFundamentals: expect.objectContaining({
					businessName: "Acme Corp",
				}),
			}),
			expect.objectContaining({ createNewVersion: true }),
		);
	});

	it("returns 400 when onboarding payload fails validation", async () => {
		const { onboardingPersistSchema } = await import("@/lib/onboarding");
		vi.mocked(onboardingPersistSchema.parse).mockImplementationOnce(() => {
			throw new Error("invalid onboarding payload");
		});

		const { PUT } = await import("@/app/api/onboarding/[clientId]/route");
		const request = new Request("http://localhost:3000/api/onboarding/client-1", {
			method: "PUT",
			body: JSON.stringify({ status: "NOT_A_REAL_STATUS" }),
		});

		const response = await PUT(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(400);
		const payload = await response.json();
		expect(payload.error).toContain("invalid onboarding payload");
	});

	it("supports PATCH as alias of PUT", async () => {
		const { PATCH } = await import("@/app/api/onboarding/[clientId]/route");

		const request = new Request("http://localhost:3000/api/onboarding/client-1", {
			method: "PATCH",
			body: JSON.stringify({
				status: "DRAFT",
				businessFundamentals: {
					businessName: "Acme Corp",
					domain: "acme.com",
				},
			}),
		});

		const response = await PATCH(request as any, {
			params: Promise.resolve({ clientId: "client-1" }),
		});

		expect(response.status).toBe(200);
	});
});
