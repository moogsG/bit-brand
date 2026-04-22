import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/authorize";

describe("visibility boundary regressions", () => {
	it("keeps account manager access scoped while agency owner remains global", () => {
		const accountManagerSession = {
			user: { role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		};
		const agencyOwnerSession = {
			user: { role: "ADMIN", rawRole: "AGENCY_OWNER" },
		};

		expect(
			can("reports", "view", {
				session: accountManagerSession,
				clientId: "client-2",
				assignedClientIds: ["client-1"],
			}),
		).toBe(false);

		expect(
			can("reports", "view", {
				session: agencyOwnerSession,
				clientId: "client-2",
			}),
		).toBe(true);
	});

	it("blocks client-equivalent roles from agency-only modules", () => {
		const clientAdminSession = {
			user: { role: "CLIENT", rawRole: "CLIENT_ADMIN", clientId: "client-1" },
		};

		expect(can("admin", "view", { session: clientAdminSession })).toBe(false);
		expect(can("clients", "edit", { session: clientAdminSession })).toBe(false);
		expect(can("content", "edit", { session: clientAdminSession })).toBe(false);
		expect(
			can("reports", "view", {
				session: clientAdminSession,
				clientId: "client-2",
			}),
		).toBe(false);
	});

	it("keeps client-scoped access enforced for new Phase 3 modules", () => {
		const accountManagerSession = {
			user: { role: "ADMIN", rawRole: "ACCOUNT_MANAGER" },
		};
		const clientViewerSession = {
			user: { role: "CLIENT", rawRole: "CLIENT_VIEWER", clientId: "client-1" },
		};

		expect(
			can("content", "view", {
				session: accountManagerSession,
				clientId: "client-2",
				assignedClientIds: ["client-1"],
			}),
		).toBe(false);

		expect(
			can("links", "view", {
				session: clientViewerSession,
				clientId: "client-2",
			}),
		).toBe(false);
	});
});
