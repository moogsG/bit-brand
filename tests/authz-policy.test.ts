import { afterEach, describe, expect, it } from "vitest";
import { can, canAccessClient } from "@/lib/auth/authorize";

describe("policy engine", () => {
	afterEach(() => {
		process.env.FF_RBAC_V2 = "true";
	});

	it("keeps legacy ADMIN fully privileged", () => {
		const session = { user: { role: "ADMIN" } };
		expect(can("clients", "edit", { session })).toBe(true);
		expect(can("sync", "execute", { session, clientId: "client-1" })).toBe(true);
	});

	it("blocks client viewer from editing messages", () => {
		const session = {
			user: { role: "CLIENT", rawRole: "CLIENT_VIEWER", clientId: "client-1" },
		};
		expect(can("messages", "view", { session, clientId: "client-1" })).toBe(true);
		expect(can("messages", "edit", { session, clientId: "client-1" })).toBe(false);
	});

	it("allows client-equivalent access only to owned client", () => {
		const session = { user: { role: "CLIENT", clientId: "client-1" } };
		expect(canAccessClient("client-1", { session })).toBe(true);
		expect(canAccessClient("client-2", { session })).toBe(false);
		expect(can("reports", "view", { session, clientId: "client-2" })).toBe(false);
	});

	it("keeps Story 1.1 role mapping compatibility", () => {
		const session = {
			user: {
				role: "ADMIN",
				rawRole: "ACCOUNT_MANAGER",
			},
		};
		expect(can("admin", "view", { session })).toBe(true);
		expect(can("apiCredentials", "edit", { session })).toBe(false);
	});

	it("requires assignments for account manager client access", () => {
		const session = {
			user: {
				role: "ADMIN",
				rawRole: "ACCOUNT_MANAGER",
			},
		};

		expect(canAccessClient("client-1", { session })).toBe(false);
		expect(
			canAccessClient("client-1", {
				session,
				assignedClientIds: ["client-1"],
			}),
		).toBe(true);
		expect(
			can("reports", "view", {
				session,
				clientId: "client-1",
				assignedClientIds: ["client-1"],
			}),
		).toBe(true);
	});

	it("keeps owner-level unrestricted client access", () => {
		const session = {
			user: {
				role: "ADMIN",
				rawRole: "AGENCY_OWNER",
			},
		};
		expect(canAccessClient("client-999", { session })).toBe(true);
	});

	it("keeps account manager scoped to assigned clients only", () => {
		const session = {
			user: {
				role: "ADMIN",
				rawRole: "ACCOUNT_MANAGER",
			},
		};

		expect(
			can("reports", "view", {
				session,
				clientId: "client-1",
				assignedClientIds: ["client-1"],
			}),
		).toBe(true);
		expect(
			can("reports", "view", {
				session,
				clientId: "client-2",
				assignedClientIds: ["client-1"],
			}),
		).toBe(false);
	});

	it("allows assignment-gated roles via explicit client membership", () => {
		const session = {
			user: {
				role: "ADMIN",
				rawRole: "ACCOUNT_MANAGER",
			},
		};

		expect(
			can("onboarding", "view", {
				session,
				clientId: "client-1",
				isClientMember: true,
			}),
		).toBe(true);
	});

	it("keeps v2 role mapping even when legacy flag is toggled", () => {
		process.env.FF_RBAC_V2 = "false";

		const session = {
			user: {
				role: "ADMIN",
				rawRole: "ACCOUNT_MANAGER",
			},
		};

		expect(canAccessClient("client-unassigned", { session })).toBe(false);
		expect(can("apiCredentials", "edit", { session })).toBe(false);
	});
});
