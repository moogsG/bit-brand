import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
		all: vi.fn(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		run: vi.fn(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
	},
}));

vi.mock("@/lib/db/schema", () => ({
	clients: {
		id: "id",
		name: "name",
	},
	clientUsers: {
		id: "id",
		clientId: "clientId",
		userId: "userId",
	},
	userClientAssignments: {
		id: "id",
		clientId: "clientId",
		userId: "userId",
	},
	syncJobs: {
		id: "id",
		clientId: "clientId",
		source: "source",
		status: "status",
		startedAt: "startedAt",
		completedAt: "completedAt",
		rowsInserted: "rowsInserted",
		error: "error",
		triggeredBy: "triggeredBy",
	},
}));

// Mock integration functions
vi.mock("@/lib/integrations/ga4", () => ({
	syncGA4Data: vi.fn(),
}));

vi.mock("@/lib/integrations/gsc", () => ({
	syncGSCData: vi.fn(),
}));

vi.mock("@/lib/integrations/moz", () => ({
	syncMozData: vi.fn(),
}));

vi.mock("@/lib/integrations/rankscale", () => ({
	syncRankscaleData: vi.fn(),
}));

vi.mock("@/lib/integrations/dataforseo", () => ({
	syncDataForSeoData: vi.fn(),
}));

describe("Sync Jobs Creation - Smoke Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

		describe("POST /api/sync/[clientId]/[source]", () => {
		it("should return 401 for unauthenticated requests", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth as any).mockResolvedValue(null);

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request("http://localhost:3000/api/sync/client-1/GA4", {
				method: "POST",
			});

			const params = Promise.resolve({ clientId: "client-1", source: "GA4" });
			const response = await POST(request as any, { params });

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data.error).toBe("Unauthorized");
		});

		it("should return 403 for unauthorized roles", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth).mockResolvedValue({
				user: { id: "user-1", email: "client@test.com", role: "CLIENT" },
			} as any);

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request("http://localhost:3000/api/sync/client-1/GA4", {
				method: "POST",
			});

			const params = Promise.resolve({ clientId: "client-1", source: "GA4" });
			const response = await POST(request as any, { params });

			expect(response.status).toBe(403);
		});

		it("should return 400 for invalid source type", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request(
				"http://localhost:3000/api/sync/client-1/INVALID",
				{ method: "POST" },
			);

			const params = Promise.resolve({ clientId: "client-1", source: "INVALID" });
			const response = await POST(request as any, { params });

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("Invalid source type");
		});

		it("should return 404 for non-existent client", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue(null);

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request(
				"http://localhost:3000/api/sync/non-existent/GA4",
				{ method: "POST" },
			);

			const params = Promise.resolve({
				clientId: "non-existent",
				source: "GA4",
			});
			const response = await POST(request as any, { params });

			expect(response.status).toBe(404);
			const data = await response.json();
			expect(data.error).toBe("Client not found");
		});

		it("should create sync job and return success for valid request", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");
			const { syncGA4Data } = await import("@/lib/integrations/ga4");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue({ id: "client-1" });

			vi.mocked(syncGA4Data).mockResolvedValue({
				success: true,
				rowsInserted: 90,
				source: "GA4",
			});

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request("http://localhost:3000/api/sync/client-1/GA4", {
				method: "POST",
			});

			const params = Promise.resolve({ clientId: "client-1", source: "GA4" });
			const response = await POST(request as any, { params });

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.rowsInserted).toBe(90);
			expect(data.source).toBe("GA4");

			// Verify sync job was created
			expect(db.insert).toHaveBeenCalled();
			expect(db.update).toHaveBeenCalled();
		});

		it("should handle sync failures and update job status", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");
			const { syncMozData } = await import("@/lib/integrations/moz");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue({ id: "client-1" });

			vi.mocked(syncMozData).mockResolvedValue({
				success: false,
				rowsInserted: 0,
				error: "API credentials not found",
				source: "MOZ",
			});

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request("http://localhost:3000/api/sync/client-1/MOZ", {
				method: "POST",
			});

			const params = Promise.resolve({ clientId: "client-1", source: "MOZ" });
			const response = await POST(request as any, { params });

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(false);
			expect(data.error).toBe("API credentials not found");

			// Verify job status was updated to FAILED
			expect(db.update).toHaveBeenCalled();
		});

		it("should handle exceptions and update job status to FAILED", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");
			const { syncRankscaleData } = await import("@/lib/integrations/rankscale");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue({ id: "client-1" });

			vi.mocked(syncRankscaleData).mockRejectedValue(
				new Error("Network timeout"),
			);

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request(
				"http://localhost:3000/api/sync/client-1/RANKSCALE",
				{ method: "POST" },
			);

			const params = Promise.resolve({
				clientId: "client-1",
				source: "RANKSCALE",
			});
			const response = await POST(request as any, { params });

			expect(response.status).toBe(500);
			const data = await response.json();
			expect(data.success).toBe(false);
			expect(data.error).toBe("Network timeout");

			// Verify job status was updated to FAILED
			expect(db.update).toHaveBeenCalled();
		});
	});

	describe("Sync Job Data Integrity", () => {
		it("should create sync job with correct initial status", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");
			const { syncGSCData } = await import("@/lib/integrations/gsc");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue({ id: "client-1" });

			let insertedJob: any = null;
			vi.mocked(db.insert as any).mockImplementation(() => ({
				values: (job: any) => {
					insertedJob = job;
					return { run: vi.fn() };
				},
			}));

			vi.mocked(syncGSCData).mockResolvedValue({
				success: true,
				rowsInserted: 50,
				source: "GSC",
			});

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request("http://localhost:3000/api/sync/client-1/GSC", {
				method: "POST",
			});

			const params = Promise.resolve({ clientId: "client-1", source: "GSC" });
			await POST(request as any, { params });

			expect(insertedJob).toBeTruthy();
			expect(insertedJob.clientId).toBe("client-1");
			expect(insertedJob.source).toBe("GSC");
			expect(insertedJob.status).toBe("RUNNING");
			expect(insertedJob.triggeredBy).toBe("MANUAL");
			expect(insertedJob.startedAt).toBeInstanceOf(Date);
		});

		it("should update sync job with completion data on success", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");
			const { syncDataForSeoData } = await import(
				"@/lib/integrations/dataforseo"
			);

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue({ id: "client-1" });

			let updatedJob: any = null;
			vi.mocked(db.update as any).mockImplementation(() => ({
				set: (job: any) => {
					updatedJob = job;
					return {
						where: vi.fn().mockReturnThis(),
						run: vi.fn(),
					};
				},
			}));

			vi.mocked(syncDataForSeoData).mockResolvedValue({
				success: true,
				rowsInserted: 100,
				source: "DATAFORSEO",
			});

			const { POST } = await import(
				"@/app/api/sync/[clientId]/[source]/route"
			);

			const request = new Request(
				"http://localhost:3000/api/sync/client-1/DATAFORSEO",
				{ method: "POST" },
			);

			const params = Promise.resolve({
				clientId: "client-1",
				source: "DATAFORSEO",
			});
			await POST(request as any, { params });

			expect(updatedJob).toBeTruthy();
			expect(updatedJob.status).toBe("SUCCESS");
			expect(updatedJob.rowsInserted).toBe(100);
			expect(updatedJob.completedAt).toBeInstanceOf(Date);
			expect(updatedJob.error).toBeNull();
		});
	});
});
