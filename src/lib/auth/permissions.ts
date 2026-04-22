import {
	type AppUserRole,
	agencyEquivalentRoles,
	appUserRoles,
	clientEquivalentRoles,
	type LegacyRole,
} from "./role-mapping";

export const permissionModules = [
	"admin",
	"portal",
	"clients",
	"assignments",
	"dataSources",
	"keywords",
	"strategies",
	"reports",
	"aiVisibility",
	"promptResearch",
	"technical",
	"content",
	"links",
	"notifications",
	"messages",
	"approvals",
	"tasks",
	"kanban",
	"sync",
	"apiCredentials",
	"settings",
	"export",
	"onboarding",
] as const;

export const permissionActions = [
	"view",
	"edit",
	"approve",
	"publish",
	"execute",
] as const;

export type PermissionModule = (typeof permissionModules)[number];
export type PermissionAction = (typeof permissionActions)[number];
export type PermissionRole = AppUserRole | LegacyRole;

type RolePolicy = Partial<
	Record<PermissionModule, readonly PermissionAction[]>
>;

const AGENCY_FULL_ACCESS: RolePolicy = {
	admin: ["view"],
	portal: ["view"],
	clients: ["view", "edit"],
	assignments: ["view", "edit"],
	dataSources: ["view", "edit"],
	keywords: ["view", "edit"],
	strategies: ["view", "edit", "publish"],
	reports: ["view", "edit", "publish"],
	aiVisibility: ["view", "edit"],
	promptResearch: ["view", "edit"],
	technical: ["view", "edit"],
	content: ["view", "edit", "publish"],
	links: ["view", "edit"],
	notifications: ["view"],
	messages: ["view", "edit"],
	approvals: ["view", "edit", "approve"],
	tasks: ["view", "edit", "approve"],
	kanban: ["view", "edit"],
	sync: ["execute"],
	apiCredentials: ["view", "edit", "execute"],
	settings: ["view", "edit"],
	export: ["execute"],
	onboarding: ["view", "edit"],
};

const ACCOUNT_MANAGER_POLICY: RolePolicy = {
	...AGENCY_FULL_ACCESS,
	assignments: [],
	apiCredentials: ["view"],
	settings: ["view"],
};

const STRATEGIST_POLICY: RolePolicy = {
	admin: ["view"],
	portal: ["view"],
	clients: ["view"],
	keywords: ["view", "edit"],
	strategies: ["view", "edit", "publish"],
	reports: ["view", "edit", "publish"],
	aiVisibility: ["view", "edit"],
	promptResearch: ["view", "edit"],
	technical: ["view", "edit"],
	content: ["view", "edit", "publish"],
	links: ["view", "edit"],
	notifications: ["view"],
	messages: ["view", "edit"],
	approvals: ["view", "approve"],
	tasks: ["view", "edit"],
	kanban: ["view", "edit"],
	export: ["execute"],
	onboarding: ["view", "edit"],
};

const CLIENT_ADMIN_POLICY: RolePolicy = {
	portal: ["view"],
	keywords: ["view"],
	strategies: ["view"],
	reports: ["view"],
	aiVisibility: ["view"],
	promptResearch: ["view"],
	technical: ["view"],
	content: ["view", "approve"],
	links: ["view"],
	notifications: ["view"],
	messages: ["view", "edit"],
	approvals: ["view", "approve"],
	export: ["execute"],
	onboarding: ["view"],
};

const CLIENT_VIEWER_POLICY: RolePolicy = {
	portal: ["view"],
	keywords: ["view"],
	strategies: ["view"],
	reports: ["view"],
	aiVisibility: ["view"],
	promptResearch: ["view"],
	technical: ["view"],
	content: ["view"],
	links: ["view"],
	notifications: ["view"],
	messages: ["view"],
	approvals: ["view"],
	export: ["execute"],
	onboarding: ["view"],
};

export const permissionMatrix: Record<PermissionRole, RolePolicy> = {
	ADMIN: AGENCY_FULL_ACCESS,
	CLIENT: CLIENT_ADMIN_POLICY,
	AGENCY_OWNER: AGENCY_FULL_ACCESS,
	ACCOUNT_MANAGER: ACCOUNT_MANAGER_POLICY,
	STRATEGIST: STRATEGIST_POLICY,
	CLIENT_ADMIN: CLIENT_ADMIN_POLICY,
	CLIENT_VIEWER: CLIENT_VIEWER_POLICY,
};

export const allKnownRoles = [...appUserRoles] as readonly PermissionRole[];
export const agencyRoles = [
	...agencyEquivalentRoles,
] as readonly PermissionRole[];
export const clientRoles = [
	...clientEquivalentRoles,
] as readonly PermissionRole[];
