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

const dbState: {
	questionnaires: any[];
	mode: "select" | "insert" | "update" | null;
	whereHint: string;
	pendingInsert: Record<string, unknown> | null;
	pendingSet: Record<string, unknown> | null;
} = {
	questionnaires: [],
	mode: null,
	whereHint: "",
	pendingInsert: null,
	pendingSet: null,
};

function collectPrimitiveHints(value: unknown, out: string[], seen = new WeakSet<object>()) {
	if (value == null) return;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
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

			if (dbState.mode === "update" && dbState.pendingSet) {
				dbState.questionnaires = dbState.questionnaires.map((row) => {
					const matchesClient = dbState.whereHint.includes(
						String(row.clientId),
					);
					const matchesType = dbState.whereHint.includes(
						String(row.contentType),
					);
					const requiresActive =
						dbState.whereHint.includes("is_active") ||
						dbState.whereHint.includes("isActive");
					const matchesActive = !requiresActive || row.isActive === true;

					if (matchesClient && matchesType && matchesActive) {
						return { ...row, ...dbState.pendingSet };
					}

					return row;
				});
			}

			return db;
		}),
		orderBy: vi.fn(() => db),
		all: vi.fn(async () => {
			if (dbState.mode !== "select") return [];

			let rows = [...dbState.questionnaires];
			if (dbState.whereHint.includes("client-1")) {
				rows = rows.filter((row) => row.clientId === "client-1");
			}
			if (dbState.whereHint.includes("BLOG")) {
				rows = rows.filter((row) => row.contentType === "BLOG");
			}
			if (dbState.whereHint.includes("LANDING_PAGE")) {
				rows = rows.filter((row) => row.contentType === "LANDING_PAGE");
			}

			return rows.sort((a, b) => b.version - a.version);
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
		update: vi.fn(() => {
			dbState.mode = "update";
			return db;
		}),
		set: vi.fn((values: Record<string, unknown>) => {
			dbState.pendingSet = values;
			return db;
		}),
		returning: vi.fn(async () => {
			if (dbState.mode === "insert" && dbState.pendingInsert) {
				const created = {
					id: `eeat-${dbState.questionnaires.length + 1}`,
					...dbState.pendingInsert,
					createdAt: new Date("2026-04-16T00:00:00.000Z"),
					updatedAt: new Date("2026-04-16T00:00:00.000Z"),
				};
				dbState.questionnaires.push(created);
				dbState.pendingInsert = null;
				dbState.pendingSet = null;
				return [created];
			}

			dbState.pendingSet = null;
			return [];
		}),
	};

	return { db };
});

describe("eeat questionnaires API", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_EEAT_QUESTIONNAIRES_V1 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");

		dbState.questionnaires = [
			{
				id: "eeat-1",
				clientId: "client-1",
				contentType: "BLOG",
				schema: JSON.stringify({ sections: [{ id: "intro" }] }),
				version: 1,
				isActive: true,
				createdAt: new Date("2026-04-01T00:00:00.000Z"),
				updatedAt: new Date("2026-04-01T00:00:00.000Z"),
			},
			{
				id: "eeat-2",
				clientId: "client-1",
				contentType: "LANDING_PAGE",
				schema: JSON.stringify({ questions: [{ id: "q1" }] }),
				version: 2,
				isActive: true,
				createdAt: new Date("2026-04-02T00:00:00.000Z"),
				updatedAt: new Date("2026-04-02T00:00:00.000Z"),
			},
			{
				id: "eeat-3",
				clientId: "client-1",
				contentType: "LANDING_PAGE",
				schema: JSON.stringify({ questions: [{ id: "q2" }] }),
				version: 1,
				isActive: false,
				createdAt: new Date("2026-03-01T00:00:00.000Z"),
				updatedAt: new Date("2026-03-01T00:00:00.000Z"),
			},
		];
		dbState.mode = null;
		dbState.whereHint = "";
		dbState.pendingInsert = null;
		dbState.pendingSet = null;

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: false,
			assignedClientIds: ["client-1"],
		});
	});

	it.skip("returns 404 when FF_EEAT_QUESTIONNAIRES_V1 is disabled", async () => {
		process.env.FF_EEAT_QUESTIONNAIRES_V1 = "false";
		const { GET } = await import("@/app/api/eeat/questionnaires/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/questionnaires?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.code).toBe("MODULE_DISABLED");
	});

	it("returns 401 for unauthenticated requests", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth).mockResolvedValueOnce(null as any);

		const { GET } = await import("@/app/api/eeat/questionnaires/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/questionnaires?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(401);
	});

	it("returns 403 when authorization check fails", async () => {
		const { can } = await import("@/lib/auth/authorize");
		vi.mocked(can).mockReturnValueOnce(false);

		const { GET } = await import("@/app/api/eeat/questionnaires/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/questionnaires?clientId=client-1",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(403);
	});

	it("GET succeeds and filters by contentType", async () => {
		const { GET } = await import("@/app/api/eeat/questionnaires/route");
		const request = new Request(
			"http://localhost:3000/api/eeat/questionnaires?clientId=client-1&contentType=landing_page",
		);
		const response = await GET(request as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveLength(2);
		expect(data.data[0].contentType).toBe("LANDING_PAGE");
		expect(data.data[0].version).toBe(2);
		expect(data.data[1].version).toBe(1);
	});

	it("POST auto-increments version when omitted", async () => {
		const { POST } = await import("@/app/api/eeat/questionnaires/route");
		const response = await POST(
			new Request("http://localhost:3000/api/eeat/questionnaires", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					contentType: " blog ",
					schema: { sections: [{ id: "proof" }] },
				}),
			}) as any,
		);

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.contentType).toBe("BLOG");
		expect(data.data.version).toBe(2);
	});

	it("POST enforces single active questionnaire per client + contentType", async () => {
		const { POST } = await import("@/app/api/eeat/questionnaires/route");
		const response = await POST(
			new Request("http://localhost:3000/api/eeat/questionnaires", {
				method: "POST",
				body: JSON.stringify({
					clientId: "client-1",
					contentType: "LANDING_PAGE",
					schema: { questions: [{ id: "new-q" }] },
					isActive: true,
				}),
			}) as any,
		);

		expect(response.status).toBe(201);

		const landingPageRows = dbState.questionnaires.filter(
			(row) =>
				row.clientId === "client-1" && row.contentType === "LANDING_PAGE",
		);
		expect(landingPageRows.filter((row) => row.isActive)).toHaveLength(1);
		expect(landingPageRows.find((row) => row.isActive)?.schema).toBe(
			JSON.stringify({ questions: [{ id: "new-q" }] }),
		);
	});
});
