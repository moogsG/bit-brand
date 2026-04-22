import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
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
vi.mock("@/lib/implementation-agent", () => ({
	listClientSafeImplementationChanges: vi.fn(),
}));

describe("implementation queue client-safe changes API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_TECHNICAL_AGENT_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");
		const { listClientSafeImplementationChanges } = await import(
			"@/lib/implementation-agent"
		);

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "CLIENT", rawRole: "CLIENT_VIEWER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: true,
			assignedClientIds: ["client-1"],
		});

		const dbAny = db as any;
		dbAny.get.mockResolvedValue({ id: "client-1" });

		vi.mocked(listClientSafeImplementationChanges).mockResolvedValue([
			{
				id: "proposal-1",
				title: "Apply robots noindex fix",
				targetRef: "https://example.com/privacy",
				approvalStatus: "APPROVED",
				execution: {
					status: "SUCCEEDED",
					executedAt: "2026-04-20T10:00:00.000Z",
					outputSnapshot: { internal: true },
				},
				rollback: null,
				updatedAt: "2026-04-20T10:01:00.000Z",
				proposal: { raw: true },
				beforeSnapshot: { raw: true },
				afterPreview: { raw: true },
				proposedPayload: { raw: true },
				timeline: [{ raw: true }],
			},
			{
				id: "proposal-2",
				title: "Draft change should not be visible",
				targetRef: "/draft",
				approvalStatus: null,
				execution: null,
				rollback: null,
				updatedAt: "2026-04-19T10:01:00.000Z",
			},
		] as any);
	});

	it("returns 401 when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null);

		const { GET } = await import(
			"@/app/api/implementation-queue/changes/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/changes?clientId=client-1",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(401);
		const json = await response.json();
		expect(json.error).toEqual({
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	});

	it("returns 403 when forbidden", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import(
			"@/app/api/implementation-queue/changes/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/changes?clientId=client-1",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(403);
		const json = await response.json();
		expect(json.error).toEqual({ code: "FORBIDDEN", message: "Forbidden" });
	});

	it("returns client-safe changes shape without sensitive payload fields", async () => {
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { GET } = await import(
			"@/app/api/implementation-queue/changes/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/changes?clientId=client-1",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(200);

		const json = await response.json();
		expect(vi.mocked(getClientAccessContext)).toHaveBeenCalledWith(
			expect.objectContaining({
				user: expect.objectContaining({ id: "user-1" }),
			}),
			"client-1",
		);
		expect(vi.mocked(can)).toHaveBeenCalledWith(
			"technical",
			"view",
			expect.objectContaining({
				clientId: "client-1",
				isClientMember: true,
				assignedClientIds: ["client-1"],
			}),
		);

		expect(json).toEqual(
			expect.objectContaining({
				version: "1.0.0",
				success: true,
				error: null,
				data: expect.objectContaining({
					clientId: "client-1",
					changes: [
						expect.objectContaining({
							id: "proposal-1",
							title: "Apply robots noindex fix",
							targetRef: "https://example.com/privacy",
							approvalStatus: "APPROVED",
							execution: expect.objectContaining({ status: "SUCCEEDED" }),
						}),
					],
				}),
			}),
		);

		expect(json.data.changes).toHaveLength(1);

		const change = json.data.changes[0] as Record<string, unknown>;
		expect(change).not.toHaveProperty("timeline");
		expect(change).not.toHaveProperty("beforeSnapshot");
		expect(change).not.toHaveProperty("afterPreview");
		expect(change).not.toHaveProperty("proposedPayload");
		expect(change).not.toHaveProperty("proposal");
		const execution = (change.execution ?? {}) as Record<string, unknown>;
		expect(execution).not.toHaveProperty("outputSnapshot");
	});

	it("applies status/type/search/date filters", async () => {
		const { listClientSafeImplementationChanges } = await import(
			"@/lib/implementation-agent"
		);
		vi.mocked(listClientSafeImplementationChanges).mockResolvedValueOnce([
			{
				id: "proposal-1",
				title: "Apply robots noindex fix",
				targetRef: "/privacy",
				approvalStatus: "APPROVED",
				execution: {
					status: "FAILED",
					executedAt: "2026-04-18T10:00:00.000Z",
				},
				rollback: null,
				updatedAt: "2026-04-18T10:01:00.000Z",
			},
			{
				id: "proposal-2",
				title: "Homepage hero copy adjustment",
				targetRef: "/",
				approvalStatus: "APPROVED",
				execution: {
					status: "SUCCEEDED",
					executedAt: "2026-04-20T10:00:00.000Z",
				},
				rollback: null,
				updatedAt: "2026-04-20T10:01:00.000Z",
			},
		] as any);

		const { GET } = await import(
			"@/app/api/implementation-queue/changes/route"
		);

		const request = {
			nextUrl: new URL(
				"http://localhost/api/implementation-queue/changes?clientId=client-1&status=FAILED&changeType=EXECUTION&search=robots&from=2026-04-01&to=2026-04-30",
			),
		} as any;

		const response = await GET(request);
		expect(response.status).toBe(200);

		const json = await response.json();
		expect(json.data.changes).toHaveLength(1);
		expect(json.data.changes[0].id).toBe("proposal-1");
		expect(json.data.filters).toEqual({
			status: "FAILED",
			changeType: "EXECUTION",
			search: "robots",
			from: "2026-04-01",
			to: "2026-04-30",
		});
	});
});
