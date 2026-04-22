import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
	can: vi.fn(),
	resolvePermissionRole: vi.fn(),
}));

vi.mock("@/lib/auth/client-access", () => ({
	getClientAccessContext: vi.fn(),
}));

vi.mock("@/lib/eeat/service", () => ({
	createEeatScoreSnapshotForResponse: vi.fn(),
}));

const dbState: {
	responses: any[];
	questionnaires: any[];
	briefs: any[];
	mode: "select" | "insert" | null;
	whereHint: string;
	pendingInsert: Record<string, unknown> | null;
} = {
	responses: [],
	questionnaires: [],
	briefs: [],
	mode: null,
	whereHint: "",
	pendingInsert: null,
};

function collectPrimitiveHints(
	value: unknown,
	out: string[],
	seen = new WeakSet<object>(),
) {
	if (value == null) return;
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		out.push(String(value));
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectPrimitiveHints(item, out, seen);
		return;
	}
	if (typeof value === "object") {
		if (seen.has(value as object)) return;
		seen.add(value as object);
		for (const v of Object.values(value as Record<string, unknown>)) {
			collectPrimitiveHints(v, out, seen);
		}
	}
}

vi.mock("@/lib/db", () => {
	const db: any = {
		select: vi.fn(() => {
			dbState.mode = "select";
			return db;
		}),
		from: vi.fn(() => db),
		where: vi.fn((condition: unknown) => {
			const hints: string[] = [];
			collectPrimitiveHints(condition, hints);
			dbState.whereHint = hints.join(" ");
			return db;
		}),
		orderBy: vi.fn(() => db),
		all: vi.fn(async () => {
			if (dbState.mode !== "select") return [];

			let rows = [...dbState.responses];
			if (dbState.whereHint.includes("client-1")) {
				rows = rows.filter((row) => row.clientId === "client-1");
			}
			if (dbState.whereHint.includes("questionnaire-1")) {
				rows = rows.filter((row) => row.questionnaireId === "questionnaire-1");
			}
			if (dbState.whereHint.includes("brief-1")) {
				rows = rows.filter((row) => row.briefId === "brief-1");
			}

			return rows.sort(
				(a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
			);
		}),
		get: vi.fn(async () => {
			if (dbState.whereHint.includes("questionnaire-1")) {
				return (
					dbState.questionnaires.find((row) => row.id === "questionnaire-1") ??
					null
				);
			}
			if (dbState.whereHint.includes("questionnaire-2")) {
				return (
					dbState.questionnaires.find((row) => row.id === "questionnaire-2") ??
					null
				);
			}
			if (dbState.whereHint.includes("brief-1")) {
				return dbState.briefs.find((row) => row.id === "brief-1") ?? null;
			}
			if (dbState.whereHint.includes("brief-2")) {
				return dbState.briefs.find((row) => row.id === "brief-2") ?? null;
			}
			return null;
		}),
		insert: vi.fn(() => {
			dbState.mode = "insert";
			return db;
		}),
		values: vi.fn((values: Record<string, unknown>) => {
			if (dbState.mode === "insert") {
				dbState.pendingInsert = values;
			}
			return db;
		}),
		returning: vi.fn(async () => {
			if (dbState.mode === "insert" && dbState.pendingInsert) {
				const created = {
					id: `response-${dbState.responses.length + 1}`,
					...dbState.pendingInsert,
				};
				dbState.responses.push(created);
				dbState.pendingInsert = null;
				return [created];
			}

			return [];
		}),
	};

	return { db };
});

describe("eeat responses API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_EEAT_QUESTIONNAIRES_V1 = "true";
		process.env.FF_EEAT_SCORING_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { createEeatScoreSnapshotForResponse } = await import(
			"@/lib/eeat/service"
		);

		dbState.responses = [
			{
				id: "response-1",
				clientId: "client-1",
				questionnaireId: "questionnaire-1",
				briefId: "brief-1",
				respondentUserId: "user-1",
				responses: JSON.stringify({ expertise: "high" }),
				updatedAt: new Date("2026-04-12T00:00:00.000Z"),
			},
			{
				id: "response-2",
				clientId: "client-1",
				questionnaireId: "questionnaire-1",
				briefId: null,
				respondentUserId: "user-2",
				responses: JSON.stringify({ trustSignals: ["award"] }),
				updatedAt: new Date("2026-04-10T00:00:00.000Z"),
			},
			{
				id: "response-3",
				clientId: "client-1",
				questionnaireId: "questionnaire-2",
				briefId: "brief-2",
				respondentUserId: "user-3",
				responses: JSON.stringify({ experience: "strong" }),
				updatedAt: new Date("2026-04-08T00:00:00.000Z"),
			},
		];

		dbState.questionnaires = [
			{ id: "questionnaire-1", clientId: "client-1" },
			{ id: "questionnaire-2", clientId: "client-2" },
		];

		dbState.briefs = [
			{ id: "brief-1", clientId: "client-1" },
			{ id: "brief-2", clientId: "client-2" },
		];

		dbState.mode = null;
		dbState.whereHint = "";
		dbState.pendingInsert = null;

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(resolvePermissionRole).mockReturnValue("ACCOUNT_MANAGER" as any);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
		vi.mocked(createEeatScoreSnapshotForResponse).mockResolvedValue(null);
	});

	it.skip("returns 404 when FF_EEAT_QUESTIONNAIRES_V1 is disabled", async () => {
		process.env.FF_EEAT_QUESTIONNAIRES_V1 = "false";
		const { GET } = await import("@/app/api/eeat/responses/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/responses?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(404);
	});

	it("returns 401 for unauthenticated requests", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/eeat/responses/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/responses?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(401);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/eeat/responses/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/responses?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(403);
	});

	it("POST succeeds for client-equivalent role on own client", async () => {
		const { auth } = await import("@/lib/auth");
		const { can, resolvePermissionRole } = await import("@/lib/auth/authorize");

		vi.mocked(auth).mockResolvedValueOnce({
			user: {
				id: "client-user-1",
				role: "CLIENT",
				rawRole: "CLIENT_ADMIN",
				clientId: "client-1",
			},
		} as any);
		vi.mocked(resolvePermissionRole).mockReturnValueOnce("CLIENT_ADMIN" as any);
		vi.mocked(can).mockImplementation((module, action) => {
			if (module === "content" && action === "edit") return false;
			if (module === "content" && action === "view") return true;
			return true;
		});

		const { POST } = await import("@/app/api/eeat/responses/route");
		const response = await POST(
			new Request("http://localhost:3000/api/eeat/responses", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					questionnaireId: "questionnaire-1",
					briefId: "brief-1",
					responses: { authority: "verified" },
				}),
			}) as any,
		);

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.respondentUserId).toBe("client-user-1");
	});

	it("POST rejects questionnaire/brief cross-client mismatch", async () => {
		const { POST } = await import("@/app/api/eeat/responses/route");

		const questionnaireMismatch = await POST(
			new Request("http://localhost:3000/api/eeat/responses", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					questionnaireId: "questionnaire-2",
					responses: { experience: "x" },
				}),
			}) as any,
		);

		expect(questionnaireMismatch.status).toBe(400);

		const briefMismatch = await POST(
			new Request("http://localhost:3000/api/eeat/responses", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					questionnaireId: "questionnaire-1",
					briefId: "brief-2",
					responses: { trust: "x" },
				}),
			}) as any,
		);

		expect(briefMismatch.status).toBe(400);
	});

	it("GET succeeds with questionnaireId/briefId filters", async () => {
		const { GET } = await import("@/app/api/eeat/responses/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/responses?clientId=client-1&questionnaireId=questionnaire-1&briefId=brief-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveLength(1);
		expect(data.data[0].id).toBe("response-1");
	});

	it("POST invokes scoring snapshot service on successful create", async () => {
		const { createEeatScoreSnapshotForResponse } = await import(
			"@/lib/eeat/service"
		);
		const { POST } = await import("@/app/api/eeat/responses/route");

		const response = await POST(
			new Request("http://localhost:3000/api/eeat/responses", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					questionnaireId: "questionnaire-1",
					responses: { authority: "verified" },
				}),
			}) as any,
		);

		expect(response.status).toBe(201);
		expect(createEeatScoreSnapshotForResponse).toHaveBeenCalledTimes(1);
		expect(createEeatScoreSnapshotForResponse).toHaveBeenCalledWith(
			"response-4",
		);
	});

	it("POST still succeeds when scoring snapshot service fails", async () => {
		const { createEeatScoreSnapshotForResponse } = await import(
			"@/lib/eeat/service"
		);
		vi.mocked(createEeatScoreSnapshotForResponse).mockRejectedValueOnce(
			new Error("scoring temporarily unavailable"),
		);

		const { POST } = await import("@/app/api/eeat/responses/route");
		const response = await POST(
			new Request("http://localhost:3000/api/eeat/responses", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					questionnaireId: "questionnaire-1",
					responses: { authority: "verified" },
				}),
			}) as any,
		);

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(createEeatScoreSnapshotForResponse).toHaveBeenCalledTimes(1);
	});
});
