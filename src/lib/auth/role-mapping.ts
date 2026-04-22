export const legacyRoles = ["ADMIN", "CLIENT"] as const;
export type LegacyRole = (typeof legacyRoles)[number];

export const rolesV2 = [
	"AGENCY_OWNER",
	"ACCOUNT_MANAGER",
	"STRATEGIST",
	"CLIENT_ADMIN",
	"CLIENT_VIEWER",
] as const;

export const appUserRoles = [...legacyRoles, ...rolesV2] as const;
export type AppUserRole = (typeof appUserRoles)[number];

export const agencyEquivalentRoles = [
	"ADMIN",
	"AGENCY_OWNER",
	"ACCOUNT_MANAGER",
	"STRATEGIST",
] as const;

export const clientEquivalentRoles = [
	"CLIENT",
	"CLIENT_ADMIN",
	"CLIENT_VIEWER",
] as const;

export function toLegacyRole(role: string | null | undefined): LegacyRole {
	if (agencyEquivalentRoles.includes(role as (typeof agencyEquivalentRoles)[number])) {
		return "ADMIN";
	}

	if (clientEquivalentRoles.includes(role as (typeof clientEquivalentRoles)[number])) {
		return "CLIENT";
	}

	return "CLIENT";
}

export function isClientEquivalentRole(
	role: string | null | undefined,
): boolean {
	return toLegacyRole(role) === "CLIENT";
}
