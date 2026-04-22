import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/authorize", () => ({ can: vi.fn() }));
vi.mock("@/lib/auth/client-access", () => ({ getClientAccessContext: vi.fn() }));

const redirectMock = vi.fn((target: string) => {
	throw new Error(`redirect:${target}`);
});

vi.mock("next/navigation", () => ({
	redirect: redirectMock,
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		get: vi.fn(),
		all: vi.fn(),
	},
}));

vi.mock("@/components/portal/portal-approvals-list", () => ({
	PortalApprovalsList: () => null,
}));

vi.mock("@/components/portal/notifications-list", () => ({
	NotificationsList: () => null,
}));

vi.mock("@/components/portal/portal-eeat-questionnaire-form", () => ({
	PortalEeatQuestionnaireForm: () => null,
}));

describe("portal v2 collaboration page gating", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		process.env.FF_PORTAL_V2 = "true";

		const { auth } = await import("@/lib/auth");
		const { can } = await import("@/lib/auth/authorize");
		const { getClientAccessContext } = await import("@/lib/auth/client-access");
		const { db } = await import("@/lib/db");

		vi.mocked(auth).mockResolvedValue({
			user: { id: "user-1", role: "CLIENT", rawRole: "CLIENT_ADMIN" },
		} as any);
		vi.mocked(can).mockReturnValue(true);
		vi.mocked(getClientAccessContext).mockResolvedValue({
			isClientMember: true,
			assignedClientIds: ["client-1"],
		});

		const dbAny = db as any;
		dbAny.get.mockResolvedValue({
			id: "client-1",
			name: "Acme Corp",
			slug: "acme-corp",
		});
		dbAny.all.mockResolvedValue([]);
	});

	it.skip("redirects approvals page when FF_PORTAL_V2 is disabled", async () => {
		process.env.FF_PORTAL_V2 = "false";
		const page = (await import("@/app/portal/[clientSlug]/approvals/page")).default;

		await expect(
			page({ params: Promise.resolve({ clientSlug: "acme-corp" }) }),
		).rejects.toThrow("redirect:/portal/acme-corp/dashboard");
	});

	it.skip("redirects notifications page when FF_PORTAL_V2 is disabled", async () => {
		process.env.FF_PORTAL_V2 = "false";
		const page = (await import(
			"@/app/portal/[clientSlug]/notifications/page"
		)).default;

		await expect(
			page({ params: Promise.resolve({ clientSlug: "acme-corp" }) }),
		).rejects.toThrow("redirect:/portal/acme-corp/dashboard");
	});

	it.skip("redirects eeat questionnaire page when FF_PORTAL_V2 is disabled", async () => {
		process.env.FF_PORTAL_V2 = "false";
		const page = (await import(
			"@/app/portal/[clientSlug]/eeat-questionnaire/page"
		)).default;

		await expect(
			page({ params: Promise.resolve({ clientSlug: "acme-corp" }) }),
		).rejects.toThrow("redirect:/portal/acme-corp/dashboard");
	});

	it("renders eeat questionnaire page when enabled and scoped", async () => {
		const page = (await import(
			"@/app/portal/[clientSlug]/eeat-questionnaire/page"
		)).default;

		await expect(
			page({ params: Promise.resolve({ clientSlug: "acme-corp" }) }),
		).resolves.toBeTruthy();
		expect(redirectMock).not.toHaveBeenCalled();
	});
});
