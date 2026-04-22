import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

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
		delete: vi.fn().mockReturnThis(),
	},
}));

vi.mock("@/lib/crypto", () => ({
	encrypt: vi.fn((data) => `encrypted:${data}`),
	decrypt: vi.fn((data) => data.replace("encrypted:", "")),
}));

vi.mock("@/lib/db/schema", () => ({
	apiCredentials: {
		id: "id",
		provider: "provider",
		credentialsEnc: "credentialsEnc",
		label: "label",
		isActive: "isActive",
		lastTestedAt: "lastTestedAt",
		createdAt: "createdAt",
		updatedAt: "updatedAt",
	},
}));

describe("API Credentials Endpoints - Smoke Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

		describe("GET /api/settings/api-credentials", () => {
		it("should return 401 for unauthenticated requests", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth as any).mockResolvedValue(null);

			const { GET } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const response = await GET();

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data.error).toBe("Unauthorized");
		});

		it("should return 403 for unauthorized roles", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth).mockResolvedValue({
				user: { id: "user-1", email: "client@test.com", role: "CLIENT" },
			} as any);

			const { GET } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const response = await GET();

			expect(response.status).toBe(403);
		});

		it("should return masked credentials for admin users", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.all).mockReturnValue([
				{
					id: "cred-1",
					provider: "MOZ",
					credentialsEnc: 'encrypted:{"accessId":"test-access-id-12345"}',
					label: "Test Moz",
					isActive: true,
					lastTestedAt: new Date(),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);

			const { GET } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const response = await GET();

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data[0].provider).toBe("MOZ");
			expect(data[0].credentials.accessId).toMatch(/\*\*\*\*/);
		});
	});

		describe("POST /api/settings/api-credentials", () => {
		it("should return 401 for unauthenticated requests", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth as any).mockResolvedValue(null);

			const { POST } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const request = new Request("http://localhost:3000/api/settings/api-credentials", {
				method: "POST",
				body: JSON.stringify({
					provider: "MOZ",
					credentials: { accessId: "test" },
				}),
			});

			const response = await POST(request);
			expect(response.status).toBe(401);
		});

		it("should return 400 for invalid provider", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			const { POST } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const request = new Request("http://localhost:3000/api/settings/api-credentials", {
				method: "POST",
				body: JSON.stringify({
					provider: "INVALID",
					credentials: { apiKey: "test" },
				}),
			});

			const response = await POST(request);
			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBe("Invalid provider");
		});

		it("should create new credentials for valid provider", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue(null);

			const { POST } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const request = new Request("http://localhost:3000/api/settings/api-credentials", {
				method: "POST",
				body: JSON.stringify({
					provider: "MOZ",
					credentials: { accessId: "test-id", secretKey: "test-secret" },
					label: "Test Moz Credentials",
				}),
			});

			const response = await POST(request);
			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(db.insert).toHaveBeenCalled();
		});

		it("should update existing credentials", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			vi.mocked(db.get).mockReturnValue({
				id: "existing-cred",
				provider: "MOZ",
				credentialsEnc: "encrypted:old-data",
				label: "Old Label",
			});

			const { POST } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const request = new Request("http://localhost:3000/api/settings/api-credentials", {
				method: "POST",
				body: JSON.stringify({
					provider: "MOZ",
					credentials: { accessId: "new-id", secretKey: "new-secret" },
					label: "Updated Label",
				}),
			});

			const response = await POST(request);
			expect(response.status).toBe(200);
			expect(db.update).toHaveBeenCalled();
		});
	});

		describe("DELETE /api/settings/api-credentials", () => {
		it("should return 401 for unauthenticated requests", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth as any).mockResolvedValue(null);

			const { DELETE } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const request = new Request(
				"http://localhost:3000/api/settings/api-credentials?provider=MOZ",
				{ method: "DELETE" },
			);

			const response = await DELETE(request);
			expect(response.status).toBe(401);
		});

		it("should return 400 for invalid provider", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			const { DELETE } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const request = new Request(
				"http://localhost:3000/api/settings/api-credentials?provider=INVALID",
				{ method: "DELETE" },
			);

			const response = await DELETE(request);
			expect(response.status).toBe(400);
		});

		it("should delete credentials for valid provider", async () => {
			const { auth } = await import("@/lib/auth");
			const { db } = await import("@/lib/db");

			vi.mocked(auth).mockResolvedValue({
				user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
			} as any);

			const { DELETE } = await import(
				"@/app/api/settings/api-credentials/route"
			);
			const request = new Request(
				"http://localhost:3000/api/settings/api-credentials?provider=MOZ",
				{ method: "DELETE" },
			);

			const response = await DELETE(request);
			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(db.delete).toHaveBeenCalled();
		});
	});
});
