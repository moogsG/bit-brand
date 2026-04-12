import { sql } from "drizzle-orm";
import {
	sqliteTable,
	text,
	integer,
	real,
	index,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text("email").notNull().unique(),
	name: text("name").notNull(),
	passwordHash: text("password_hash"),
	role: text("role", { enum: ["ADMIN", "CLIENT"] })
		.notNull()
		.default("CLIENT"),
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
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("ai_visibility_client_date_idx").on(t.clientId, t.date)],
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
	(t) => [index("kanban_columns_client_position_idx").on(t.clientId, t.position)],
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
		body: text("body").notNull(),
		readAt: integer("read_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("client_messages_client_idx").on(t.clientId, t.createdAt),
		index("client_messages_sender_idx").on(t.senderId),
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

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientUser = typeof clientUsers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type DataSource = typeof dataSources.$inferSelect;
export type KeywordResearch = typeof keywordResearch.$inferSelect;
export type NewKeywordResearch = typeof keywordResearch.$inferInsert;
export type SeoStrategy = typeof seoStrategies.$inferSelect;
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type AiVisibility = typeof aiVisibility.$inferSelect;
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
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// Tasks & Kanban
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type ClientMessage = typeof clientMessages.$inferSelect;
export type NewClientMessage = typeof clientMessages.$inferInsert;
