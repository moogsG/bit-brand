import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const legacyUserRoles = ["ADMIN", "CLIENT"] as const;
export const userRolesV2 = [
	"AGENCY_OWNER",
	"ACCOUNT_MANAGER",
	"STRATEGIST",
	"CLIENT_ADMIN",
	"CLIENT_VIEWER",
] as const;
export const userRoles = [...legacyUserRoles, ...userRolesV2] as const;
export type UserRole = (typeof userRoles)[number];

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text("email").notNull().unique(),
	name: text("name").notNull(),
	passwordHash: text("password_hash"),
	role: text("role", { enum: userRoles })
		.notNull()
		.default("CLIENT")
		.$type<UserRole>(),
	avatarUrl: text("avatar_url"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// ─── Clients ─────────────────────────────────────────────────────────────────

export const clients = sqliteTable("clients", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	domain: text("domain").notNull(),
	slug: text("slug").notNull().unique(),
	logoUrl: text("logo_url"),
	industry: text("industry"),
	notes: text("notes"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdBy: text("created_by")
		.notNull()
		.references(() => users.id),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// ─── Client Users (portal access) ────────────────────────────────────────────

export const clientUsers = sqliteTable(
	"client_users",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("unique_client_user").on(t.clientId, t.userId)],
);

// ─── User Client Assignments (agency scoped access) ─────────────────────────

export const userClientAssignments = sqliteTable(
	"user_client_assignments",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		assignedBy: text("assigned_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("unique_user_client_assignment").on(t.userId, t.clientId),
		index("user_client_assignments_user_idx").on(t.userId),
		index("user_client_assignments_client_idx").on(t.clientId),
	],
);

// ─── Client Onboarding Profiles ──────────────────────────────────────────────

export const onboardingProfileStatus = ["DRAFT", "COMPLETED"] as const;

export const clientOnboardingProfiles = sqliteTable(
	"client_onboarding_profiles",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		version: integer("version").notNull().default(1),
		status: text("status", { enum: onboardingProfileStatus })
			.notNull()
			.default("DRAFT"),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		updatedBy: text("updated_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("onboarding_client_version_unique").on(t.clientId, t.version),
		index("onboarding_client_updated_idx").on(t.clientId, t.updatedAt),
	],
);

export const onboardingBusinessFundamentals = sqliteTable(
	"onboarding_business_fundamentals",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		profileId: text("profile_id")
			.notNull()
			.references(() => clientOnboardingProfiles.id, { onDelete: "cascade" }),
		businessName: text("business_name").notNull(),
		domain: text("domain").notNull(),
		industry: text("industry"),
		targetGeo: text("target_geo"),
		primaryOffer: text("primary_offer"),
		idealCustomer: text("ideal_customer"),
		pricingModel: text("pricing_model"),
		salesCycleDays: integer("sales_cycle_days"),
		notes: text("notes"),
	},
	(t) => [uniqueIndex("onboarding_business_profile_unique").on(t.profileId)],
);

export const onboardingNorthStarGoals = sqliteTable(
	"onboarding_north_star_goals",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		profileId: text("profile_id")
			.notNull()
			.references(() => clientOnboardingProfiles.id, { onDelete: "cascade" }),
		statement: text("statement").notNull(),
		metricName: text("metric_name"),
		currentValue: real("current_value"),
		targetValue: real("target_value"),
		targetDate: text("target_date"),
		timeHorizonMonths: integer("time_horizon_months"),
		confidenceNotes: text("confidence_notes"),
	},
	(t) => [uniqueIndex("onboarding_north_star_profile_unique").on(t.profileId)],
);

export const onboardingConversionArchitecture = sqliteTable(
	"onboarding_conversion_architecture",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		profileId: text("profile_id")
			.notNull()
			.references(() => clientOnboardingProfiles.id, { onDelete: "cascade" }),
		primaryConversion: text("primary_conversion").notNull(),
		secondaryConversions: text("secondary_conversions").notNull().default("[]"),
		leadCapturePoints: text("lead_capture_points").notNull().default("[]"),
		crmPlatform: text("crm_platform"),
		analyticsStack: text("analytics_stack"),
		attributionModel: text("attribution_model"),
	},
	(t) => [uniqueIndex("onboarding_conversion_profile_unique").on(t.profileId)],
);

export const onboardingStrategicLevers = sqliteTable(
	"onboarding_strategic_levers",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		profileId: text("profile_id")
			.notNull()
			.references(() => clientOnboardingProfiles.id, { onDelete: "cascade" }),
		lever: text("lever").notNull(),
		priority: text("priority", { enum: ["HIGH", "MEDIUM", "LOW"] })
			.notNull()
			.default("MEDIUM"),
		ownerRole: text("owner_role"),
		notes: text("notes"),
		position: integer("position").notNull().default(0),
	},
	(t) => [index("onboarding_levers_profile_idx").on(t.profileId, t.position)],
);

export const onboardingCompetitors = sqliteTable(
	"onboarding_competitors",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		profileId: text("profile_id")
			.notNull()
			.references(() => clientOnboardingProfiles.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		domain: text("domain"),
		positioning: text("positioning"),
		strengths: text("strengths"),
		weaknesses: text("weaknesses"),
		position: integer("position").notNull().default(0),
	},
	(t) => [
		index("onboarding_competitors_profile_idx").on(t.profileId, t.position),
	],
);

export const onboardingCurrentStateBaselines = sqliteTable(
	"onboarding_current_state_baselines",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		profileId: text("profile_id")
			.notNull()
			.references(() => clientOnboardingProfiles.id, { onDelete: "cascade" }),
		monthlyOrganicSessions: integer("monthly_organic_sessions"),
		monthlyLeads: integer("monthly_leads"),
		leadToCustomerRate: real("lead_to_customer_rate"),
		closeRate: real("close_rate"),
		averageOrderValue: real("average_order_value"),
		customerLifetimeValue: real("customer_lifetime_value"),
		notes: text("notes"),
	},
	(t) => [uniqueIndex("onboarding_baseline_profile_unique").on(t.profileId)],
);

// ─── Invitations ─────────────────────────────────────────────────────────────

export const invitations = sqliteTable(
	"invitations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		email: text("email").notNull(),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		acceptedAt: integer("accepted_at", { mode: "timestamp" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("invitations_token_idx").on(t.token),
		index("invitations_email_idx").on(t.email),
	],
);

// ─── Data Sources ─────────────────────────────────────────────────────────────

export const dataSources = sqliteTable(
	"data_sources",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		type: text("type", {
			enum: ["GA4", "GSC", "MOZ", "DATAFORSEO", "RANKSCALE"],
		}).notNull(),
		propertyIdentifier: text("property_identifier"),
		isConnected: integer("is_connected", { mode: "boolean" })
			.notNull()
			.default(false),
		lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
		lastSyncError: text("last_sync_error"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("unique_client_source").on(t.clientId, t.type)],
);

// ─── API Credentials (agency-level) ──────────────────────────────────────────

export const apiCredentials = sqliteTable(
	"api_credentials",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		provider: text("provider")
			.notNull()
			.$type<"GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE">(),
		credentialsEnc: text("credentials_enc").notNull(),
		label: text("label"),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		lastTestedAt: integer("last_tested_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("unique_provider").on(t.provider)],
);

// ─── Sync Jobs ───────────────────────────────────────────────────────────────

export const syncJobs = sqliteTable(
	"sync_jobs",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		source: text("source")
			.notNull()
			.$type<"GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE">(),
		status: text("status")
			.notNull()
			.default("PENDING")
			.$type<
				"PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "FAILED_PERMANENT"
			>(),
		startedAt: integer("started_at", { mode: "timestamp" }),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		rowsInserted: integer("rows_inserted"),
		error: text("error"),
		triggeredBy: text("triggered_by")
			.notNull()
			.default("MANUAL")
			.$type<"MANUAL" | "SCHEDULER" | "API">(),
		retryCount: integer("retry_count").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("sync_jobs_client_source_idx").on(t.clientId, t.source, t.createdAt),
	],
);

// ─── GA4 Metrics ─────────────────────────────────────────────────────────────

export const ga4Metrics = sqliteTable(
	"ga4_metrics",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // YYYY-MM-DD
		sessions: integer("sessions").notNull().default(0),
		users: integer("users").notNull().default(0),
		newUsers: integer("new_users").notNull().default(0),
		pageviews: integer("pageviews").notNull().default(0),
		bounceRate: real("bounce_rate"),
		avgSessionDuration: real("avg_session_duration"),
		organicSessions: integer("organic_sessions").default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("ga4_client_date_idx").on(t.clientId, t.date)],
);

// ─── GSC Metrics ─────────────────────────────────────────────────────────────

export const gscMetrics = sqliteTable(
	"gsc_metrics",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // YYYY-MM-DD
		query: text("query").notNull(),
		page: text("page"),
		clicks: integer("clicks").notNull().default(0),
		impressions: integer("impressions").notNull().default(0),
		ctr: real("ctr"),
		position: real("position"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("gsc_client_date_query_idx").on(t.clientId, t.date, t.query)],
);

// ─── Moz Metrics ────────────────────────────────────────────────────────────

export const mozMetrics = sqliteTable(
	"moz_metrics",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // YYYY-MM-DD
		domainAuthority: integer("domain_authority"), // 0-100
		pageAuthority: integer("page_authority"), // 0-100
		spamScore: integer("spam_score"), // 0-100
		brandAuthority: integer("brand_authority"), // 0-100
		backlinks: integer("backlinks").default(0),
		referringDomains: integer("referring_domains").default(0),
		organicKeywords: integer("organic_keywords").default(0),
		organicTraffic: integer("organic_traffic").default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("moz_client_date_idx").on(t.clientId, t.date)],
);

// ─── Rankscale Metrics (AI Visibility for tested prompts) ────────────────────

export const rankscaleMetrics = sqliteTable(
	"rankscale_metrics",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // YYYY-MM-DD
		prompt: text("prompt").notNull(),
		platform: text("platform").notNull(), // e.g. "ChatGPT", "Perplexity", "Gemini"
		isVisible: integer("is_visible", { mode: "boolean" })
			.notNull()
			.default(false),
		position: integer("position"), // position in AI response if visible
		responseSnippet: text("response_snippet"),
		visibilityScore: real("visibility_score"), // 0-100
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("rankscale_client_date_idx").on(t.clientId, t.date)],
);

// ─── Keyword Research ─────────────────────────────────────────────────────────

export const keywordResearch = sqliteTable(
	"keyword_research",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		keyword: text("keyword").notNull(),
		monthlyVolume: integer("monthly_volume"),
		difficulty: integer("difficulty"), // 0-100
		intent: text("intent", {
			enum: ["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"],
		}),
		priority: text("priority", { enum: ["HIGH", "MEDIUM", "LOW"] }).default(
			"MEDIUM",
		),
		currentPosition: integer("current_position"),
		targetPosition: integer("target_position"),
		targetUrl: text("target_url"),
		notes: text("notes"),
		tags: text("tags"), // JSON array string
		lastEnrichedAt: integer("last_enriched_at", { mode: "timestamp" }),
		status: text("status", {
			enum: ["OPPORTUNITY", "TARGETING", "RANKING", "WON"],
		}).default("OPPORTUNITY"),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("keyword_client_idx").on(t.clientId)],
);

// ─── Technical Audits (Phase 1 / Objective E) ────────────────────────────────

export const technicalAuditRunStatus = [
	"RUNNING",
	"SUCCESS",
	"PARTIAL",
	"FAILED",
] as const;

export const technicalIssueType = [
	"MISSING_TITLE",
	"TITLE_TOO_LONG",
	"MISSING_META_DESCRIPTION",
	"META_DESCRIPTION_TOO_LONG",
	"MISSING_CANONICAL",
	"CANONICAL_MISMATCH",
	"MISSING_SCHEMA",
	"BROKEN_LINK",
	"FETCH_ERROR",
] as const;

export const technicalIssueSeverity = ["INFO", "WARNING", "CRITICAL"] as const;

export type TechnicalAuditRunStatus = (typeof technicalAuditRunStatus)[number];
export type TechnicalIssueType = (typeof technicalIssueType)[number];
export type TechnicalIssueSeverity = (typeof technicalIssueSeverity)[number];

export const technicalAuditRuns = sqliteTable(
	"technical_audit_runs",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		status: text("status", { enum: technicalAuditRunStatus })
			.notNull()
			.default("RUNNING"),
		seedUrls: text("seed_urls").notNull().default("[]"), // JSON array
		triggeredBy: text("triggered_by").references(() => users.id, {
			onDelete: "set null",
		}),
		pagesCrawled: integer("pages_crawled").notNull().default(0),
		issuesFound: integer("issues_found").notNull().default(0),
		error: text("error"),
		startedAt: integer("started_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("technical_audit_runs_client_started_idx").on(
			t.clientId,
			t.startedAt,
		),
		index("technical_audit_runs_status_idx").on(t.status),
	],
);

export const technicalIssues = sqliteTable(
	"technical_issues",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		runId: text("run_id")
			.notNull()
			.references(() => technicalAuditRuns.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		issueType: text("issue_type", { enum: technicalIssueType }).notNull(),
		severity: text("severity", { enum: technicalIssueSeverity })
			.notNull()
			.default("WARNING"),
		message: text("message").notNull(),
		details: text("details").notNull().default("{}"),
		priorityScore: integer("priority_score").notNull().default(0),
		priorityBand: text("priority_band", {
			enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
		})
			.notNull()
			.default("LOW"),
		proposable: integer("proposable", { mode: "boolean" })
			.notNull()
			.default(false),
		proposableRationale: text("proposable_rationale").notNull().default(""),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("technical_issues_run_idx").on(t.runId),
		index("technical_issues_client_severity_idx").on(t.clientId, t.severity),
		index("technical_issues_client_type_idx").on(t.clientId, t.issueType),
		index("technical_issues_client_priority_idx").on(
			t.clientId,
			t.priorityBand,
			t.priorityScore,
		),
	],
);

// ─── Content Assets (Phase 3 / EPIC-12 / Story 12.1) ─────────────────────────

export const contentAssets = sqliteTable(
	"content_assets",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		title: text("title"),
		contentType: text("content_type").notNull().default("UNKNOWN"),
		status: text("status").notNull().default("ACTIVE"),
		canonicalUrl: text("canonical_url"),
		publishedAt: integer("published_at", { mode: "timestamp" }),
		lastCrawledAt: integer("last_crawled_at", { mode: "timestamp" }),
		metadata: text("metadata").notNull().default("{}"), // JSON object (agency-only by default)
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("content_assets_client_url_unique").on(t.clientId, t.url),
		index("content_assets_client_idx").on(t.clientId),
		index("content_assets_client_status_idx").on(t.clientId, t.status),
		index("content_assets_client_type_idx").on(t.clientId, t.contentType),
	],
);

// ─── Content Audit Findings (Phase 3 / EPIC-12 / Story 12.2) ─────────────────

export const contentAuditFindings = sqliteTable(
	"content_audit_findings",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		assetId: text("asset_id")
			.notNull()
			.references(() => contentAssets.id, { onDelete: "cascade" }),
		recommendationType: text("recommendation_type", {
			enum: ["REFRESH", "CONSOLIDATE", "DELETE", "RETARGET"],
		}).notNull(),
		severity: text("severity", { enum: ["INFO", "WARNING", "CRITICAL"] })
			.notNull()
			.default("INFO"),
		reason: text("reason").notNull(),
		proposedChanges: text("proposed_changes").notNull().default("{}"), // JSON object
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("content_audit_findings_client_created_idx").on(
			t.clientId,
			t.createdAt,
		),
		index("content_audit_findings_asset_idx").on(t.assetId),
		index("content_audit_findings_client_type_idx").on(
			t.clientId,
			t.recommendationType,
		),
	],
);

// ─── Content Briefs (Phase 3 / EPIC-13 / Story 13.1) ─────────────────────────

export const contentBriefStatuses = [
	"DRAFT",
	"AWAITING_CLIENT_INPUT",
	"READY_FOR_APPROVAL",
	"APPROVED",
	"IN_PROGRESS",
	"DONE",
] as const;

export const contentBriefs = sqliteTable(
	"content_briefs",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		assetId: text("asset_id").references(() => contentAssets.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		primaryKeyword: text("primary_keyword").notNull(),
		supportingKeywords: text("supporting_keywords").notNull().default("[]"), // JSON array
		outline: text("outline").notNull().default("{}"), // JSON object
		status: text("status", { enum: contentBriefStatuses })
			.notNull()
			.default("DRAFT"),
		clientVisibleSummary: text("client_visible_summary"),
		internalNotes: text("internal_notes"),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		updatedBy: text("updated_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("content_briefs_client_updated_idx").on(t.clientId, t.updatedAt),
		index("content_briefs_client_status_idx").on(t.clientId, t.status),
		index("content_briefs_asset_idx").on(t.assetId),
	],
);

// ─── Content Brief Versions (Phase 3 / EPIC-13 / Story 13.2) ─────────────────

export const contentVersions = sqliteTable(
	"content_versions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		briefId: text("brief_id")
			.notNull()
			.references(() => contentBriefs.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		body: text("body").notNull(),
		diffSummary: text("diff_summary"),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("content_versions_brief_version_unique").on(
			t.briefId,
			t.version,
		),
		index("content_versions_brief_created_idx").on(t.briefId, t.createdAt),
	],
);

// ─── Content Calendar Items (Phase 3 / EPIC-13 / Story 13.3) ────────────────

export const contentCalendarWorkflowStatuses = [
	"BACKLOG",
	"PLANNED",
	"IN_PROGRESS",
	"IN_REVIEW",
	"APPROVED",
	"SCHEDULED",
	"PUBLISHED",
	"BLOCKED",
] as const;

export const contentCalendarItems = sqliteTable(
	"content_calendar_items",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		briefId: text("brief_id").references(() => contentBriefs.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		ownerUserId: text("owner_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		dueDate: text("due_date"),
		publishDate: text("publish_date"),
		workflowStatus: text("workflow_status", {
			enum: contentCalendarWorkflowStatuses,
		})
			.notNull()
			.default("BACKLOG"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("content_calendar_items_client_due_date_idx").on(
			t.clientId,
			t.dueDate,
		),
		index("content_calendar_items_client_publish_date_idx").on(
			t.clientId,
			t.publishDate,
		),
		index("content_calendar_items_client_status_idx").on(
			t.clientId,
			t.workflowStatus,
		),
		index("content_calendar_items_client_updated_idx").on(
			t.clientId,
			t.updatedAt,
		),
	],
);

// ─── EEAT Questionnaires (Phase 3 / EPIC-14 / Story 14.1) ───────────────────

export const eeatQuestionnaires = sqliteTable(
	"eeat_questionnaires",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		contentType: text("content_type").notNull(),
		schema: text("schema").notNull(), // JSON object
		version: integer("version").notNull().default(1),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("eeat_questionnaires_client_content_type_idx").on(
			t.clientId,
			t.contentType,
		),
		index("eeat_questionnaires_client_active_idx").on(t.clientId, t.isActive),
		uniqueIndex("eeat_questionnaires_client_content_type_version_unique").on(
			t.clientId,
			t.contentType,
			t.version,
		),
	],
);

// ─── EEAT Responses (Phase 3 / EPIC-14 / Story 14.2) ────────────────────────

export const eeatResponses = sqliteTable(
	"eeat_responses",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		questionnaireId: text("questionnaire_id")
			.notNull()
			.references(() => eeatQuestionnaires.id, { onDelete: "cascade" }),
		briefId: text("brief_id").references(() => contentBriefs.id, {
			onDelete: "set null",
		}),
		respondentUserId: text("respondent_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		responses: text("responses").notNull(), // JSON object
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("eeat_responses_client_questionnaire_idx").on(
			t.clientId,
			t.questionnaireId,
		),
		index("eeat_responses_client_brief_idx").on(t.clientId, t.briefId),
		index("eeat_responses_client_updated_idx").on(t.clientId, t.updatedAt),
	],
);

// ─── EEAT Scores (Phase 2 / EEAT Scoring v1) ───────────────────────────────

export const eeatScores = sqliteTable(
	"eeat_scores",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		questionnaireId: text("questionnaire_id")
			.notNull()
			.references(() => eeatQuestionnaires.id, { onDelete: "cascade" }),
		responseId: text("response_id")
			.notNull()
			.references(() => eeatResponses.id, { onDelete: "cascade" }),
		briefId: text("brief_id").references(() => contentBriefs.id, {
			onDelete: "set null",
		}),
		overallScore: real("overall_score").notNull(),
		factorBreakdown: text("factor_breakdown").notNull(), // JSON array
		recommendations: text("recommendations").notNull(), // JSON array
		scoreVersion: text("score_version").notNull().default("eeat-score-v1"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("eeat_scores_response_unique").on(t.responseId),
		index("eeat_scores_client_created_idx").on(t.clientId, t.createdAt),
		index("eeat_scores_client_questionnaire_created_idx").on(
			t.clientId,
			t.questionnaireId,
			t.createdAt,
		),
		index("eeat_scores_client_brief_created_idx").on(
			t.clientId,
			t.briefId,
			t.createdAt,
		),
	],
);

// ─── Backlink Inventory (Phase 3 / EPIC-15 / Story 15.1) ────────────────────

export const backlinkInventoryStatuses = ["ACTIVE", "LOST"] as const;

export const backlinkInventory = sqliteTable(
	"backlink_inventory",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		sourceUrl: text("source_url").notNull(),
		sourceDomain: text("source_domain").notNull(),
		targetUrl: text("target_url").notNull(),
		anchorText: text("anchor_text"),
		firstSeenAt: integer("first_seen_at", { mode: "timestamp" }),
		lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
		status: text("status", { enum: backlinkInventoryStatuses })
			.notNull()
			.default("ACTIVE"),
		metrics: text("metrics").notNull().default("{}"), // JSON object
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("backlink_inventory_client_status_idx").on(t.clientId, t.status),
		index("backlink_inventory_client_source_domain_idx").on(
			t.clientId,
			t.sourceDomain,
		),
		index("backlink_inventory_client_last_seen_idx").on(
			t.clientId,
			t.lastSeenAt,
		),
		uniqueIndex("backlink_inventory_client_source_target_unique").on(
			t.clientId,
			t.sourceUrl,
			t.targetUrl,
		),
	],
);

// ─── Link Prospects + Outreach Drafts (Phase 3 / EPIC-15 / Stories 15.2-15.3) ──

export const linkProspectLifecycleStates = [
	"DISCOVERED",
	"QUALIFIED",
	"CONTACTED",
	"RESPONDED",
	"WON",
	"DISQUALIFIED",
] as const;

export const linkProspects = sqliteTable(
	"link_prospects",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		domain: text("domain").notNull(),
		url: text("url"),
		contactName: text("contact_name"),
		contactEmail: text("contact_email"),
		notes: text("notes"),
		lifecycleState: text("lifecycle_state", {
			enum: linkProspectLifecycleStates,
		})
			.notNull()
			.default("DISCOVERED"),
		relevanceScore: integer("relevance_score").notNull().default(0),
		authorityScore: integer("authority_score").notNull().default(0),
		trafficScore: integer("traffic_score").notNull().default(0),
		relationshipScore: integer("relationship_score").notNull().default(0),
		deterministicScore: integer("deterministic_score").notNull().default(0),
		scoreBreakdown: text("score_breakdown").notNull().default("{}"),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		updatedBy: text("updated_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("link_prospects_client_state_idx").on(t.clientId, t.lifecycleState),
		index("link_prospects_client_score_idx").on(t.clientId, t.deterministicScore),
		index("link_prospects_client_domain_idx").on(t.clientId, t.domain),
	],
);

export const linkOutreachDraftStatuses = [
	"DRAFT",
	"PENDING_APPROVAL",
	"APPROVED",
	"SENT",
	"FAILED",
] as const;

export const linkOutreachDrafts = sqliteTable(
	"link_outreach_drafts",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		prospectId: text("prospect_id")
			.notNull()
			.references(() => linkProspects.id, { onDelete: "cascade" }),
		subject: text("subject").notNull(),
		body: text("body").notNull(),
		status: text("status", { enum: linkOutreachDraftStatuses })
			.notNull()
			.default("DRAFT"),
		approvalId: text("approval_id").references(() => approvals.id, {
			onDelete: "set null",
		}),
		requestedApprovalAt: integer("requested_approval_at", { mode: "timestamp" }),
		approvedAt: integer("approved_at", { mode: "timestamp" }),
		sentAt: integer("sent_at", { mode: "timestamp" }),
		sentBy: text("sent_by").references(() => users.id, { onDelete: "set null" }),
		sendMetadata: text("send_metadata").notNull().default("{}"),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		updatedBy: text("updated_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("link_outreach_drafts_client_status_idx").on(t.clientId, t.status),
		index("link_outreach_drafts_client_prospect_idx").on(
			t.clientId,
			t.prospectId,
		),
		index("link_outreach_drafts_client_sent_idx").on(t.clientId, t.sentAt),
		index("link_outreach_drafts_approval_idx").on(t.approvalId),
	],
);

// ─── SEO Strategies ───────────────────────────────────────────────────────────

export const seoStrategies = sqliteTable("seo_strategies", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	clientId: text("client_id")
		.notNull()
		.references(() => clients.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	// JSON: array of { id, title, content (rich text HTML), order }
	sections: text("sections").notNull().default("[]"),
	status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }).default(
		"DRAFT",
	),
	publishedAt: integer("published_at", { mode: "timestamp" }),
	createdBy: text("created_by")
		.notNull()
		.references(() => users.id),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// ─── Monthly Reports ──────────────────────────────────────────────────────────

export const monthlyReports = sqliteTable(
	"monthly_reports",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		month: integer("month").notNull(), // 1-12
		year: integer("year").notNull(),
		title: text("title").notNull(),
		// Predefined sections JSON:
		// { executiveSummary, trafficOverview, keywordRankings, backlinkProfile, aiVisibility, wins, opportunities, nextMonthGoals }
		// Each section has: { adminNotes (rich text), autoData (pulled from integrations) }
		sections: text("sections").notNull().default("{}"),
		status: text("status", {
			enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
		}).default("DRAFT"),
		publishedAt: integer("published_at", { mode: "timestamp" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("unique_client_month_year").on(t.clientId, t.month, t.year),
	],
);

// ─── AI Visibility (manual + aggregated) ─────────────────────────────────────

export const aiVisibility = sqliteTable(
	"ai_visibility",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // YYYY-MM-DD
		overallScore: real("overall_score"), // 0-100 aggregated
		rankscaleScore: real("rankscale_score"),
		secondaryScore: integer("secondary_score"),
		totalPromptsTested: integer("total_prompts_tested").default(0),
		promptsVisible: integer("prompts_visible").default(0),
		engineBreakdown: text("engine_breakdown").notNull().default("{}"), // JSON object
		lastRunId: text("last_run_id"),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("ai_visibility_client_date_idx").on(t.clientId, t.date)],
);

// ─── AI Visibility Prompt Sets + Prompts (Phase 2 / EPIC-06 / Story 6.1) ─────

export const aiVisibilityPromptSets = sqliteTable(
	"ai_visibility_prompt_sets",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		metadata: text("metadata").notNull().default("{}"), // JSON object (prompt set metadata)
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		updatedBy: text("updated_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("ai_visibility_prompt_sets_client_idx").on(t.clientId),
		index("ai_visibility_prompt_sets_client_active_idx").on(
			t.clientId,
			t.isActive,
		),
	],
);

export const aiVisibilityPrompts = sqliteTable(
	"ai_visibility_prompts",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		promptSetId: text("prompt_set_id")
			.notNull()
			.references(() => aiVisibilityPromptSets.id, { onDelete: "cascade" }),
		text: text("text").notNull(),
		order: integer("order").notNull().default(0),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		metadata: text("metadata").notNull().default("{}"), // JSON object (prompt metadata)
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		updatedBy: text("updated_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("ai_visibility_prompts_set_order_idx").on(t.promptSetId, t.order),
		index("ai_visibility_prompts_set_active_idx").on(t.promptSetId, t.isActive),
	],
);

// ─── AI Visibility Runs + Results (Phase 2 / EPIC-06 / Story 6.2) ─────────────

export const aiVisibilityRuns = sqliteTable(
	"ai_visibility_runs",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		promptSetId: text("prompt_set_id")
			.notNull()
			.references(() => aiVisibilityPromptSets.id, { onDelete: "cascade" }),
		// JSON array of engines: ["CHATGPT", "PERPLEXITY", "GEMINI"]
		engines: text("engines").notNull().default("[]"),
		status: text("status").notNull().default("PENDING"),
		triggeredBy: text("triggered_by")
			.notNull()
			.references(() => users.id),
		startedAt: integer("started_at", { mode: "timestamp" }),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		error: text("error"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("ai_visibility_runs_client_idx").on(t.clientId),
		index("ai_visibility_runs_prompt_set_idx").on(t.promptSetId),
		index("ai_visibility_runs_status_idx").on(t.status),
		index("ai_visibility_runs_client_created_idx").on(t.clientId, t.createdAt),
	],
);

export const aiVisibilityRunResults = sqliteTable(
	"ai_visibility_run_results",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		runId: text("run_id")
			.notNull()
			.references(() => aiVisibilityRuns.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		promptId: text("prompt_id")
			.notNull()
			.references(() => aiVisibilityPrompts.id, { onDelete: "cascade" }),
		engine: text("engine").notNull(),
		promptText: text("prompt_text").notNull(),
		isVisible: integer("is_visible", { mode: "boolean" })
			.notNull()
			.default(false),
		position: integer("position"),
		citationDomain: text("citation_domain"),
		citationSnippet: text("citation_snippet"),
		responseSnippet: text("response_snippet"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("ai_visibility_run_results_run_idx").on(t.runId),
		index("ai_visibility_run_results_client_idx").on(t.clientId),
		index("ai_visibility_run_results_engine_idx").on(t.engine),
		index("ai_visibility_run_results_prompt_idx").on(t.promptId),
		index("ai_visibility_run_results_run_engine_idx").on(t.runId, t.engine),
	],
);

// ─── Prompt Research Citations (Phase 2 / EPIC-07 / Story 7.1) ───────────────

export const aiPromptCitations = sqliteTable(
	"ai_prompt_citations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // YYYY-MM-DD (run date)
		runId: text("run_id")
			.notNull()
			.references(() => aiVisibilityRuns.id, { onDelete: "cascade" }),
		runResultId: text("run_result_id")
			.notNull()
			.references(() => aiVisibilityRunResults.id, { onDelete: "cascade" }),
		promptId: text("prompt_id")
			.notNull()
			.references(() => aiVisibilityPrompts.id, { onDelete: "cascade" }),
		engine: text("engine").notNull(),
		domain: text("domain").notNull(),
		url: text("url"),
		title: text("title"),
		contentType: text("content_type").notNull().default("UNKNOWN"),
		freshnessHint: text("freshness_hint").notNull().default("UNKNOWN"),
		firstSeenAt: integer("first_seen_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("ai_prompt_citations_client_date_idx").on(t.clientId, t.date),
		index("ai_prompt_citations_client_domain_idx").on(t.clientId, t.domain),
		index("ai_prompt_citations_client_engine_idx").on(t.clientId, t.engine),
		index("ai_prompt_citations_run_idx").on(t.runId),
		index("ai_prompt_citations_run_result_idx").on(t.runResultId),
		uniqueIndex("ai_prompt_citations_unique").on(
			t.runResultId,
			t.domain,
			t.url,
		),
	],
);

// ─── AI Interactions (Phase 2 / EPIC-08 / Story 8.3) ─────────────────────────

export const aiInteractions = sqliteTable(
	"ai_interactions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		requestId: text("request_id").notNull(),
		routeKey: text("route_key").notNull(),
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "cascade",
		}),
		userId: text("user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		module: text("module"),
		lensKey: text("lens_key"),
		scope: text("scope", { enum: ["agency-full", "client-safe"] }),
		httpStatus: integer("http_status").notNull(),
		success: integer("success", { mode: "boolean" }).notNull().default(true),
		durationMs: integer("duration_ms").notNull().default(0),
		inputShapeHash: text("input_shape_hash").notNull(),
		outputShapeHash: text("output_shape_hash").notNull(),
		errorCode: text("error_code"),
		meta: text("meta").notNull().default("{}"), // JSON (redacted safe fields only)
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("ai_interactions_request_id_unique").on(t.requestId),
		index("ai_interactions_client_idx").on(t.clientId),
		index("ai_interactions_route_created_idx").on(t.routeKey, t.createdAt),
		index("ai_interactions_user_idx").on(t.userId),
	],
);

// ─── Roles (RBAC) ────────────────────────────────────────────────────────────

export const roles = sqliteTable("roles", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull().unique(), // e.g. "MARKETING_LEAD", "SEO_SPECIALIST"
	description: text("description"),
	permissions: text("permissions").notNull().default("[]"), // JSON array of permission strings
	isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false), // true for built-in roles
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// ─── Role Assignments (scoped to org/client) ─────────────────────────────────

export const roleAssignments = sqliteTable(
	"role_assignments",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		// Scope: null = global, clientId = client-specific
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "cascade",
		}),
		assignedBy: text("assigned_by")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("unique_user_role_scope").on(t.userId, t.roleId, t.clientId),
	],
);

// ─── Approval Policies ───────────────────────────────────────────────────────

export const approvalPolicies = sqliteTable("approval_policies", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull().unique(), // e.g. "report_publish"
	description: text("description"),
	resourceType: text("resource_type").notNull(), // "REPORT", "STRATEGY", etc.
	action: text("action").notNull(), // "PUBLISH", "ARCHIVE", etc.
	requiredRoles: text("required_roles").notNull().default("[]"), // JSON array of role names
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// ─── Approvals ───────────────────────────────────────────────────────────────

export const approvals = sqliteTable(
	"approvals",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		policyId: text("policy_id")
			.notNull()
			.references(() => approvalPolicies.id),
		resourceType: text("resource_type").notNull(),
		resourceId: text("resource_id").notNull(), // ID of the report/strategy/etc.
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		requestedBy: text("requested_by")
			.notNull()
			.references(() => users.id),
		status: text("status", {
			enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
		})
			.notNull()
			.default("PENDING"),
		approvedBy: text("approved_by").references(() => users.id),
		approvedAt: integer("approved_at", { mode: "timestamp" }),
		rejectedBy: text("rejected_by").references(() => users.id),
		rejectedAt: integer("rejected_at", { mode: "timestamp" }),
		rejectionReason: text("rejection_reason"),
		metadata: text("metadata").default("{}"), // JSON for additional context
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("approvals_status_idx").on(t.status),
		index("approvals_resource_idx").on(t.resourceType, t.resourceId),
		index("approvals_client_idx").on(t.clientId),
	],
);

// ─── Revision Requests ───────────────────────────────────────────────────────

export const revisionRequests = sqliteTable("revision_requests", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	approvalId: text("approval_id")
		.notNull()
		.references(() => approvals.id, { onDelete: "cascade" }),
	requestedBy: text("requested_by")
		.notNull()
		.references(() => users.id),
	reason: text("reason").notNull(),
	suggestions: text("suggestions"), // Optional improvement suggestions
	status: text("status", { enum: ["OPEN", "ADDRESSED", "DISMISSED"] })
		.notNull()
		.default("OPEN"),
	addressedBy: text("addressed_by").references(() => users.id),
	addressedAt: integer("addressed_at", { mode: "timestamp" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// ─── Implementation Agent Queue ──────────────────────────────────────────────

export const implementationProposalStatuses = [
	"DRAFT",
	"PENDING_APPROVAL",
	"APPROVED",
	"EXECUTING",
	"EXECUTED",
	"FAILED",
	"ROLLED_BACK",
] as const;

export const implementationExecutionStatuses = [
	"RUNNING",
	"SUCCEEDED",
	"FAILED",
	"ROLLED_BACK",
] as const;

export const implementationRollbackStatuses = [
	"RUNNING",
	"SUCCEEDED",
	"FAILED",
] as const;

export const implementationSnapshotTypes = [
	"PRE_EXECUTION",
	"POST_EXECUTION",
	"PRE_ROLLBACK",
	"POST_ROLLBACK",
] as const;

export const implementationProposals = sqliteTable(
	"implementation_proposals",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		proposalJson: text("proposal_json").notNull().default("{}"),
		status: text("status", { enum: implementationProposalStatuses })
			.notNull()
			.default("DRAFT"),
		provider: text("provider").notNull().default("noop"),
		requestedBy: text("requested_by")
			.notNull()
			.references(() => users.id),
		approvalId: text("approval_id").references(() => approvals.id, {
			onDelete: "set null",
		}),
		sourceTechnicalIssueId: text("source_technical_issue_id"),
		sourceTechnicalAuditRunId: text("source_technical_audit_run_id"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("implementation_proposals_client_idx").on(t.clientId, t.updatedAt),
		index("implementation_proposals_status_idx").on(t.status),
		index("implementation_proposals_approval_idx").on(t.approvalId),
		index("implementation_proposals_source_issue_idx").on(
			t.clientId,
			t.sourceTechnicalIssueId,
		),
		index("implementation_proposals_source_run_idx").on(
			t.clientId,
			t.sourceTechnicalAuditRunId,
		),
	],
);

export const implementationExecutions = sqliteTable(
	"implementation_executions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		proposalId: text("proposal_id")
			.notNull()
			.references(() => implementationProposals.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		provider: text("provider").notNull().default("noop"),
		status: text("status", { enum: implementationExecutionStatuses })
			.notNull()
			.default("RUNNING"),
		startedBy: text("started_by")
			.notNull()
			.references(() => users.id),
		output: text("output").notNull().default("{}"),
		error: text("error"),
		startedAt: integer("started_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		completedAt: integer("completed_at", { mode: "timestamp" }),
	},
	(t) => [
		index("implementation_executions_proposal_idx").on(
			t.proposalId,
			t.startedAt,
		),
		index("implementation_executions_client_idx").on(t.clientId, t.startedAt),
		index("implementation_executions_status_idx").on(t.status),
	],
);

export const implementationRollbacks = sqliteTable(
	"implementation_rollbacks",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		executionId: text("execution_id")
			.notNull()
			.references(() => implementationExecutions.id, { onDelete: "cascade" }),
		proposalId: text("proposal_id")
			.notNull()
			.references(() => implementationProposals.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		requestedBy: text("requested_by")
			.notNull()
			.references(() => users.id),
		reason: text("reason"),
		status: text("status", { enum: implementationRollbackStatuses })
			.notNull()
			.default("RUNNING"),
		details: text("details").notNull().default("{}"),
		error: text("error"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		completedAt: integer("completed_at", { mode: "timestamp" }),
	},
	(t) => [
		index("implementation_rollbacks_execution_idx").on(t.executionId),
		index("implementation_rollbacks_proposal_idx").on(
			t.proposalId,
			t.createdAt,
		),
		index("implementation_rollbacks_client_idx").on(t.clientId, t.createdAt),
		index("implementation_rollbacks_status_idx").on(t.status),
	],
);

export const implementationSnapshots = sqliteTable(
	"implementation_snapshots",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		proposalId: text("proposal_id")
			.notNull()
			.references(() => implementationProposals.id, { onDelete: "cascade" }),
		executionId: text("execution_id").references(() => implementationExecutions.id, {
			onDelete: "set null",
		}),
		rollbackId: text("rollback_id").references(() => implementationRollbacks.id, {
			onDelete: "set null",
		}),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		type: text("type", { enum: implementationSnapshotTypes })
			.notNull()
			.default("PRE_EXECUTION"),
		payload: text("payload").notNull().default("{}"),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("implementation_snapshots_proposal_idx").on(t.proposalId, t.createdAt),
		index("implementation_snapshots_execution_idx").on(t.executionId),
		index("implementation_snapshots_rollback_idx").on(t.rollbackId),
		index("implementation_snapshots_client_idx").on(t.clientId, t.createdAt),
		index("implementation_snapshots_type_idx").on(t.type),
	],
);

// ─── Audit Logs (append-only) ────────────────────────────────────────────────

export const auditLogs = sqliteTable(
	"audit_logs",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id").references(() => users.id), // null for system actions
		action: text("action").notNull(), // "CREATE", "UPDATE", "DELETE", "APPROVE", etc.
		resourceType: text("resource_type").notNull(),
		resourceId: text("resource_id").notNull(),
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "cascade",
		}),
		changes: text("changes").default("{}"), // JSON snapshot of changes
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("audit_logs_user_idx").on(t.userId),
		index("audit_logs_resource_idx").on(t.resourceType, t.resourceId),
		index("audit_logs_client_idx").on(t.clientId),
		index("audit_logs_created_idx").on(t.createdAt),
	],
);

// ─── Kanban Columns ──────────────────────────────────────────────────────────

export const kanbanColumns = sqliteTable(
	"kanban_columns",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		position: integer("position").notNull().default(0),
		color: text("color"), // hex color for visual distinction
		isDefault: integer("is_default", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("kanban_columns_client_position_idx").on(t.clientId, t.position),
	],
);

// ─── Client Messages (two-way messaging) ─────────────────────────────────────

export const clientMessages = sqliteTable(
	"client_messages",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		senderId: text("sender_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		senderRole: text("sender_role", { enum: ["ADMIN", "CLIENT"] })
			.notNull()
			.default("CLIENT"),
		recipientScope: text("recipient_scope", {
			enum: ["TEAM", "MEMBERS"],
		})
			.notNull()
			.default("TEAM"),
		recipientUserIds: text("recipient_user_ids").notNull().default("[]"),
		body: text("body").notNull(),
		readAt: integer("read_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("client_messages_client_idx").on(t.clientId, t.createdAt),
		index("client_messages_sender_idx").on(t.senderId),
		index("client_messages_recipient_scope_idx").on(t.clientId, t.recipientScope),
	],
);

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		status: text("status", {
			enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"],
		})
			.notNull()
			.default("TODO"),
		priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] })
			.notNull()
			.default("MEDIUM"),
		assignedTo: text("assigned_to").references(() => users.id),
		createdBy: text("created_by")
			.notNull()
			.references(() => users.id),
		dueDate: integer("due_date", { mode: "timestamp" }),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		kanbanColumnId: text("kanban_column_id").references(
			() => kanbanColumns.id,
			{ onDelete: "set null" },
		),
		position: integer("position").notNull().default(0), // for ordering within column
		tags: text("tags").default("[]"), // JSON array
		linkedResourceType: text("linked_resource_type"), // "REPORT", "STRATEGY", etc.
		linkedResourceId: text("linked_resource_id"),
		linkedResourceLabel: text("linked_resource_label"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("tasks_client_idx").on(t.clientId),
		index("tasks_assigned_idx").on(t.assignedTo),
		index("tasks_status_idx").on(t.status),
		index("tasks_column_position_idx").on(t.kanbanColumnId, t.position),
	],
);

export const notifications = sqliteTable(
	"notifications",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		recipientUserId: text("recipient_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
		type: text("type", {
			enum: ["TASK_OVERDUE", "TASK_BLOCKED"],
		}).notNull(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		readAt: integer("read_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("notifications_recipient_created_idx").on(
			t.recipientUserId,
			t.createdAt,
		),
		index("notifications_client_created_idx").on(t.clientId, t.createdAt),
		index("notifications_task_type_created_idx").on(
			t.taskId,
			t.type,
			t.createdAt,
		),
	],
);

// ─── Plan Parity: Identity & Access Tables ───────────────────────────────────

export const permissions = sqliteTable(
	"permissions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		key: text("key").notNull().unique(), // module.action, e.g. "reports.publish"
		module: text("module").notNull(),
		action: text("action").notNull(),
		description: text("description"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("permissions_module_action_idx").on(t.module, t.action),
	],
);

export const rolePermissions = sqliteTable(
	"role_permissions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		permissionId: text("permission_id")
			.notNull()
			.references(() => permissions.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("role_permissions_unique").on(t.roleId, t.permissionId),
		index("role_permissions_role_idx").on(t.roleId),
		index("role_permissions_permission_idx").on(t.permissionId),
	],
);

// ─── Plan Parity: Strategy & Onboarding Domain Tables ────────────────────────

export const northStarGoals = sqliteTable(
	"north_star_goals",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		statement: text("statement").notNull(),
		metricName: text("metric_name"),
		currentValue: real("current_value"),
		targetValue: real("target_value"),
		targetDate: text("target_date"),
		status: text("status", { enum: ["DRAFT", "ACTIVE", "ACHIEVED", "ARCHIVED"] })
			.notNull()
			.default("ACTIVE"),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("north_star_goals_client_updated_idx").on(t.clientId, t.updatedAt)],
);

export const conversionDefinitions = sqliteTable(
	"conversion_definitions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		definitionJson: text("definition_json").notNull().default("{}"),
		isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("conversion_definitions_client_idx").on(t.clientId),
		index("conversion_definitions_client_primary_idx").on(t.clientId, t.isPrimary),
	],
);

export const strategicLevers = sqliteTable(
	"strategic_levers",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		lever: text("lever").notNull(),
		priority: text("priority", { enum: ["HIGH", "MEDIUM", "LOW"] })
			.notNull()
			.default("MEDIUM"),
		ownerRole: text("owner_role"),
		notes: text("notes"),
		position: integer("position").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("strategic_levers_client_position_idx").on(t.clientId, t.position)],
);

export const competitorProfiles = sqliteTable(
	"competitor_profiles",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		domain: text("domain"),
		positioning: text("positioning"),
		notes: text("notes"),
		position: integer("position").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("competitor_profiles_client_position_idx").on(t.clientId, t.position)],
);

// ─── Plan Parity: AI Context & Recommendations Tables ────────────────────────

export const aiContextSnapshots = sqliteTable(
	"ai_context_snapshots",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		scope: text("scope", { enum: ["agency-full", "client-safe"] })
			.notNull()
			.default("agency-full"),
		version: text("version").notNull().default("1.0.0"),
		payload: text("payload").notNull().default("{}"),
		generatedAt: integer("generated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("ai_context_snapshots_client_generated_idx").on(t.clientId, t.generatedAt)],
);

export const aiLensConfigs = sqliteTable(
	"ai_lens_configs",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		lensKey: text("lens_key").notNull(),
		module: text("module").notNull(),
		version: text("version").notNull().default("1.0.0"),
		systemInstructions: text("system_instructions").notNull().default(""),
		scoringFramework: text("scoring_framework").notNull().default("{}"),
		outputSchema: text("output_schema").notNull().default("{}"),
		allowedActions: text("allowed_actions").notNull().default("[]"),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("ai_lens_configs_module_lens_version_unique").on(
			t.module,
			t.lensKey,
			t.version,
		),
		index("ai_lens_configs_module_active_idx").on(t.module, t.isActive),
	],
);

export const aiRecommendations = sqliteTable(
	"ai_recommendations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		module: text("module").notNull(),
		lensKey: text("lens_key"),
		title: text("title").notNull(),
		rationale: text("rationale").notNull().default(""),
		priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH"] })
			.notNull()
			.default("MEDIUM"),
		status: text("status", { enum: ["OPEN", "APPROVED", "REJECTED", "ARCHIVED"] })
			.notNull()
			.default("OPEN"),
		approvalRequired: integer("approval_required", { mode: "boolean" })
			.notNull()
			.default(true),
		recommendationJson: text("recommendation_json").notNull().default("{}"),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("ai_recommendations_client_module_idx").on(t.clientId, t.module),
		index("ai_recommendations_client_status_idx").on(t.clientId, t.status),
	],
);

// ─── Plan Parity: Prompt Research & Visibility Tables ────────────────────────

export const promptTests = sqliteTable(
	"prompt_tests",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		promptSetId: text("prompt_set_id").references(() => aiVisibilityPromptSets.id, {
			onDelete: "set null",
		}),
		promptId: text("prompt_id").references(() => aiVisibilityPrompts.id, {
			onDelete: "set null",
		}),
		runId: text("run_id").references(() => aiVisibilityRuns.id, {
			onDelete: "set null",
		}),
		engine: text("engine").notNull(),
		promptText: text("prompt_text").notNull(),
		resultJson: text("result_json").notNull().default("{}"),
		testedAt: integer("tested_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("prompt_tests_client_tested_idx").on(t.clientId, t.testedAt),
		index("prompt_tests_run_idx").on(t.runId),
	],
);

export const promptCompetitorVisibility = sqliteTable(
	"prompt_competitor_visibility",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // YYYY-MM-DD
		competitorDomain: text("competitor_domain").notNull(),
		engine: text("engine").notNull(),
		promptId: text("prompt_id").references(() => aiVisibilityPrompts.id, {
			onDelete: "set null",
		}),
		appearanceScore: real("appearance_score"),
		avgPosition: real("avg_position"),
		citationsCount: integer("citations_count").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("prompt_competitor_visibility_client_date_idx").on(t.clientId, t.date),
		index("prompt_competitor_visibility_client_domain_idx").on(
			t.clientId,
			t.competitorDomain,
		),
	],
);

export const aiVisibilityScores = sqliteTable(
	"ai_visibility_scores",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		overallScore: real("overall_score"),
		rankscaleScore: real("rankscale_score"),
		secondaryScore: real("secondary_score"),
		totalPromptsTested: integer("total_prompts_tested").notNull().default(0),
		promptsVisible: integer("prompts_visible").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("ai_visibility_scores_client_date_unique").on(t.clientId, t.date),
		index("ai_visibility_scores_client_date_idx").on(t.clientId, t.date),
	],
);

// ─── Plan Parity: Content & Collaboration Tables ─────────────────────────────

export const contentApprovals = sqliteTable(
	"content_approvals",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		briefId: text("brief_id").references(() => contentBriefs.id, {
			onDelete: "set null",
		}),
		assetId: text("asset_id").references(() => contentAssets.id, {
			onDelete: "set null",
		}),
		approvalId: text("approval_id").references(() => approvals.id, {
			onDelete: "set null",
		}),
		status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] })
			.notNull()
			.default("PENDING"),
		requestedBy: text("requested_by").references(() => users.id, {
			onDelete: "set null",
		}),
		resolvedBy: text("resolved_by").references(() => users.id, {
			onDelete: "set null",
		}),
		notes: text("notes"),
		requestedAt: integer("requested_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		resolvedAt: integer("resolved_at", { mode: "timestamp" }),
	},
	(t) => [index("content_approvals_client_status_idx").on(t.clientId, t.status)],
);

export const approvalRequests = sqliteTable(
	"approval_requests",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		approvalId: text("approval_id").references(() => approvals.id, {
			onDelete: "set null",
		}),
		resourceType: text("resource_type").notNull(),
		resourceId: text("resource_id").notNull(),
		status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] })
			.notNull()
			.default("PENDING"),
		metadata: text("metadata").notNull().default("{}"),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("approval_requests_client_status_idx").on(t.clientId, t.status),
		index("approval_requests_resource_idx").on(t.resourceType, t.resourceId),
	],
);

export const messageThreads = sqliteTable(
	"message_threads",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		isInternalOnly: integer("is_internal_only", { mode: "boolean" })
			.notNull()
			.default(false),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("message_threads_client_updated_idx").on(t.clientId, t.updatedAt)],
);

export const threadParticipants = sqliteTable(
	"thread_participants",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		threadId: text("thread_id")
			.notNull()
			.references(() => messageThreads.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		joinedAt: integer("joined_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("thread_participants_unique").on(t.threadId, t.userId),
		index("thread_participants_user_idx").on(t.userId),
	],
);

export const kanbanCards = sqliteTable(
	"kanban_cards",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		columnId: text("column_id").references(() => kanbanColumns.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		description: text("description"),
		status: text("status").notNull().default("TODO"),
		priority: text("priority").notNull().default("MEDIUM"),
		assignedTo: text("assigned_to").references(() => users.id, {
			onDelete: "set null",
		}),
		linkedResourceType: text("linked_resource_type"),
		linkedResourceId: text("linked_resource_id"),
		position: integer("position").notNull().default(0),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		dueDate: integer("due_date", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("kanban_cards_client_column_position_idx").on(
			t.clientId,
			t.columnId,
			t.position,
		),
		index("kanban_cards_assigned_idx").on(t.assignedTo),
	],
);

// ─── Plan Parity: Links Tables ───────────────────────────────────────────────

export const backlinkAlerts = sqliteTable(
	"backlink_alerts",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		backlinkId: text("backlink_id").references(() => backlinkInventory.id, {
			onDelete: "set null",
		}),
		alertType: text("alert_type").notNull(),
		severity: text("severity", { enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] })
			.notNull()
			.default("MEDIUM"),
		status: text("status", { enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED"] })
			.notNull()
			.default("OPEN"),
		message: text("message").notNull(),
		metadata: text("metadata").notNull().default("{}"),
		firstDetectedAt: integer("first_detected_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		resolvedAt: integer("resolved_at", { mode: "timestamp" }),
	},
	(t) => [
		index("backlink_alerts_client_status_idx").on(t.clientId, t.status),
		index("backlink_alerts_backlink_idx").on(t.backlinkId),
	],
);

export const linkOutreachSequences = sqliteTable(
	"link_outreach_sequences",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		prospectId: text("prospect_id").references(() => linkProspects.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		status: text("status", { enum: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"] })
			.notNull()
			.default("DRAFT"),
		ownerUserId: text("owner_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		currentStep: integer("current_step").notNull().default(0),
		nextFollowUpAt: integer("next_follow_up_at", { mode: "timestamp" }),
		metadata: text("metadata").notNull().default("{}"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("link_outreach_sequences_client_status_idx").on(t.clientId, t.status),
		index("link_outreach_sequences_prospect_idx").on(t.prospectId),
	],
);

export const linkPipelineEvents = sqliteTable(
	"link_pipeline_events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		prospectId: text("prospect_id").references(() => linkProspects.id, {
			onDelete: "set null",
		}),
		sequenceId: text("sequence_id").references(() => linkOutreachSequences.id, {
			onDelete: "set null",
		}),
		eventType: text("event_type").notNull(),
		stateFrom: text("state_from"),
		stateTo: text("state_to"),
		notes: text("notes"),
		occurredBy: text("occurred_by").references(() => users.id, {
			onDelete: "set null",
		}),
		occurredAt: integer("occurred_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("link_pipeline_events_client_occurred_idx").on(t.clientId, t.occurredAt),
		index("link_pipeline_events_prospect_idx").on(t.prospectId),
	],
);

// ─── Plan Parity: Sales Tables ───────────────────────────────────────────────

export const prospects = sqliteTable(
	"prospects",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		company: text("company"),
		website: text("website"),
		email: text("email"),
		status: text("status", { enum: ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"] })
			.notNull()
			.default("NEW"),
		source: text("source"),
		score: real("score"),
		ownerUserId: text("owner_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("prospects_status_idx").on(t.status),
		index("prospects_owner_idx").on(t.ownerUserId),
	],
);

export const prospectAudits = sqliteTable(
	"prospect_audits",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		prospectId: text("prospect_id")
			.notNull()
			.references(() => prospects.id, { onDelete: "cascade" }),
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "set null",
		}),
		auditJson: text("audit_json").notNull().default("{}"),
		score: real("score"),
		summary: text("summary"),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("prospect_audits_prospect_created_idx").on(t.prospectId, t.createdAt),
	],
);

export const salesPipelineEvents = sqliteTable(
	"sales_pipeline_events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		prospectId: text("prospect_id")
			.notNull()
			.references(() => prospects.id, { onDelete: "cascade" }),
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "set null",
		}),
		stage: text("stage").notNull(),
		eventType: text("event_type").notNull(),
		notes: text("notes"),
		occurredBy: text("occurred_by").references(() => users.id, {
			onDelete: "set null",
		}),
		occurredAt: integer("occurred_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("sales_pipeline_events_prospect_occurred_idx").on(
			t.prospectId,
			t.occurredAt,
		),
	],
);

export const outreachMessages = sqliteTable(
	"outreach_messages",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		prospectId: text("prospect_id")
			.notNull()
			.references(() => prospects.id, { onDelete: "cascade" }),
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "set null",
		}),
		channel: text("channel").notNull().default("EMAIL"),
		subject: text("subject"),
		body: text("body").notNull(),
		status: text("status", { enum: ["DRAFT", "APPROVED", "SENT", "FAILED"] })
			.notNull()
			.default("DRAFT"),
		sentBy: text("sent_by").references(() => users.id, {
			onDelete: "set null",
		}),
		externalMessageId: text("external_message_id"),
		sentAt: integer("sent_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("outreach_messages_prospect_status_idx").on(t.prospectId, t.status),
	],
);

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientUser = typeof clientUsers.$inferSelect;
export type UserClientAssignment = typeof userClientAssignments.$inferSelect;
export type NewUserClientAssignment = typeof userClientAssignments.$inferInsert;
export type ClientOnboardingProfile =
	typeof clientOnboardingProfiles.$inferSelect;
export type NewClientOnboardingProfile =
	typeof clientOnboardingProfiles.$inferInsert;
export type OnboardingBusinessFundamentals =
	typeof onboardingBusinessFundamentals.$inferSelect;
export type NewOnboardingBusinessFundamentals =
	typeof onboardingBusinessFundamentals.$inferInsert;
export type OnboardingNorthStarGoal =
	typeof onboardingNorthStarGoals.$inferSelect;
export type NewOnboardingNorthStarGoal =
	typeof onboardingNorthStarGoals.$inferInsert;
export type OnboardingConversionArchitecture =
	typeof onboardingConversionArchitecture.$inferSelect;
export type NewOnboardingConversionArchitecture =
	typeof onboardingConversionArchitecture.$inferInsert;
export type OnboardingStrategicLever =
	typeof onboardingStrategicLevers.$inferSelect;
export type NewOnboardingStrategicLever =
	typeof onboardingStrategicLevers.$inferInsert;
export type OnboardingCompetitor = typeof onboardingCompetitors.$inferSelect;
export type NewOnboardingCompetitor = typeof onboardingCompetitors.$inferInsert;
export type OnboardingCurrentStateBaseline =
	typeof onboardingCurrentStateBaselines.$inferSelect;
export type NewOnboardingCurrentStateBaseline =
	typeof onboardingCurrentStateBaselines.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type DataSource = typeof dataSources.$inferSelect;
export type KeywordResearch = typeof keywordResearch.$inferSelect;
export type NewKeywordResearch = typeof keywordResearch.$inferInsert;
export type TechnicalAuditRun = typeof technicalAuditRuns.$inferSelect;
export type NewTechnicalAuditRun = typeof technicalAuditRuns.$inferInsert;
export type TechnicalIssue = typeof technicalIssues.$inferSelect;
export type NewTechnicalIssue = typeof technicalIssues.$inferInsert;
export type ContentAsset = typeof contentAssets.$inferSelect;
export type NewContentAsset = typeof contentAssets.$inferInsert;
export type ContentAuditFinding = typeof contentAuditFindings.$inferSelect;
export type NewContentAuditFinding = typeof contentAuditFindings.$inferInsert;
export type ContentBrief = typeof contentBriefs.$inferSelect;
export type NewContentBrief = typeof contentBriefs.$inferInsert;
export type ContentVersion = typeof contentVersions.$inferSelect;
export type NewContentVersion = typeof contentVersions.$inferInsert;
export type ContentCalendarItem = typeof contentCalendarItems.$inferSelect;
export type NewContentCalendarItem = typeof contentCalendarItems.$inferInsert;
export type EeatQuestionnaire = typeof eeatQuestionnaires.$inferSelect;
export type NewEeatQuestionnaire = typeof eeatQuestionnaires.$inferInsert;
export type EeatResponse = typeof eeatResponses.$inferSelect;
export type NewEeatResponse = typeof eeatResponses.$inferInsert;
export type EeatScore = typeof eeatScores.$inferSelect;
export type NewEeatScore = typeof eeatScores.$inferInsert;
export type BacklinkInventory = typeof backlinkInventory.$inferSelect;
export type NewBacklinkInventory = typeof backlinkInventory.$inferInsert;
export type LinkProspect = typeof linkProspects.$inferSelect;
export type NewLinkProspect = typeof linkProspects.$inferInsert;
export type LinkOutreachDraft = typeof linkOutreachDrafts.$inferSelect;
export type NewLinkOutreachDraft = typeof linkOutreachDrafts.$inferInsert;
export type SeoStrategy = typeof seoStrategies.$inferSelect;
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type AiVisibility = typeof aiVisibility.$inferSelect;
export type AiVisibilityPromptSet = typeof aiVisibilityPromptSets.$inferSelect;
export type NewAiVisibilityPromptSet =
	typeof aiVisibilityPromptSets.$inferInsert;
export type AiVisibilityPrompt = typeof aiVisibilityPrompts.$inferSelect;
export type NewAiVisibilityPrompt = typeof aiVisibilityPrompts.$inferInsert;
export type AiVisibilityRun = typeof aiVisibilityRuns.$inferSelect;
export type NewAiVisibilityRun = typeof aiVisibilityRuns.$inferInsert;
export type AiVisibilityRunResult = typeof aiVisibilityRunResults.$inferSelect;
export type NewAiVisibilityRunResult =
	typeof aiVisibilityRunResults.$inferInsert;
export type AiPromptCitation = typeof aiPromptCitations.$inferSelect;
export type NewAiPromptCitation = typeof aiPromptCitations.$inferInsert;
export type AiInteraction = typeof aiInteractions.$inferSelect;
export type NewAiInteraction = typeof aiInteractions.$inferInsert;
export type ApiCredential = typeof apiCredentials.$inferSelect;
export type NewApiCredential = typeof apiCredentials.$inferInsert;
export type SyncJob = typeof syncJobs.$inferSelect;
export type NewSyncJob = typeof syncJobs.$inferInsert;
export type MozMetric = typeof mozMetrics.$inferSelect;
export type NewMozMetric = typeof mozMetrics.$inferInsert;

// RBAC & Approvals
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type NewRoleAssignment = typeof roleAssignments.$inferInsert;
export type ApprovalPolicy = typeof approvalPolicies.$inferSelect;
export type NewApprovalPolicy = typeof approvalPolicies.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type RevisionRequest = typeof revisionRequests.$inferSelect;
export type NewRevisionRequest = typeof revisionRequests.$inferInsert;
export type ImplementationProposal =
	typeof implementationProposals.$inferSelect;
export type NewImplementationProposal =
	typeof implementationProposals.$inferInsert;
export type ImplementationExecution =
	typeof implementationExecutions.$inferSelect;
export type NewImplementationExecution =
	typeof implementationExecutions.$inferInsert;
export type ImplementationRollback =
	typeof implementationRollbacks.$inferSelect;
export type NewImplementationRollback =
	typeof implementationRollbacks.$inferInsert;
export type ImplementationSnapshot =
	typeof implementationSnapshots.$inferSelect;
export type NewImplementationSnapshot =
	typeof implementationSnapshots.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// Tasks & Kanban
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type ClientMessage = typeof clientMessages.$inferSelect;
export type NewClientMessage = typeof clientMessages.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
