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
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["ADMIN", "CLIENT"] }).notNull().default("CLIENT"),
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
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  industry: text("industry"),
  notes: text("notes"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── Client Users (portal access) ────────────────────────────────────────────

export const clientUsers = sqliteTable("client_users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("unique_client_user").on(t.clientId, t.userId),
]);

// ─── Invitations ─────────────────────────────────────────────────────────────

export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("invitations_token_idx").on(t.token),
  index("invitations_email_idx").on(t.email),
]);

// ─── Data Sources ─────────────────────────────────────────────────────────────

export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["GA4", "GSC", "AHREFS", "RANKSCALE", "SEMRUSH"],
  }).notNull(),
  // Encrypted JSON string containing API credentials/tokens
  credentialsEnc: text("credentials_enc"),
  // GA4/GSC specific
  propertyId: text("property_id"),
  siteUrl: text("site_url"),
  // OAuth tokens (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }),
  isConnected: integer("is_connected", { mode: "boolean" }).notNull().default(false),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  lastSyncError: text("last_sync_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("unique_client_source").on(t.clientId, t.type),
]);

// ─── GA4 Metrics ─────────────────────────────────────────────────────────────

export const ga4Metrics = sqliteTable("ga4_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
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
}, (t) => [
  uniqueIndex("ga4_client_date_idx").on(t.clientId, t.date),
]);

// ─── GSC Metrics ─────────────────────────────────────────────────────────────

export const gscMetrics = sqliteTable("gsc_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
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
}, (t) => [
  index("gsc_client_date_query_idx").on(t.clientId, t.date, t.query),
]);

// ─── Ahrefs Metrics ──────────────────────────────────────────────────────────

export const ahrefsMetrics = sqliteTable("ahrefs_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  domainRating: real("domain_rating"),
  urlRating: real("url_rating"),
  backlinks: integer("backlinks").default(0),
  referringDomains: integer("referring_domains").default(0),
  organicKeywords: integer("organic_keywords").default(0),
  organicTraffic: integer("organic_traffic").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ahrefs_client_date_idx").on(t.clientId, t.date),
]);

// ─── Rankscale Metrics (AI Visibility for tested prompts) ────────────────────

export const rankscaleMetrics = sqliteTable("rankscale_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  prompt: text("prompt").notNull(),
  platform: text("platform").notNull(), // e.g. "ChatGPT", "Perplexity", "Gemini"
  isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(false),
  position: integer("position"), // position in AI response if visible
  responseSnippet: text("response_snippet"),
  visibilityScore: real("visibility_score"), // 0-100
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("rankscale_client_date_idx").on(t.clientId, t.date),
]);

// ─── SEMrush AI Visibility ────────────────────────────────────────────────────

export const semrushMetrics = sqliteTable("semrush_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  aiVisibilityScore: real("ai_visibility_score"),
  brandMentions: integer("brand_mentions").default(0),
  platform: text("platform"), // "overall" or specific AI platform
  competitorComparison: text("competitor_comparison"), // JSON string
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("semrush_client_date_idx").on(t.clientId, t.date),
]);

// ─── Keyword Research ─────────────────────────────────────────────────────────

export const keywordResearch = sqliteTable("keyword_research", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  monthlyVolume: integer("monthly_volume"),
  difficulty: integer("difficulty"), // 0-100
  intent: text("intent", { enum: ["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"] }),
  priority: text("priority", { enum: ["HIGH", "MEDIUM", "LOW"] }).default("MEDIUM"),
  currentPosition: integer("current_position"),
  targetPosition: integer("target_position"),
  targetUrl: text("target_url"),
  notes: text("notes"),
  tags: text("tags"), // JSON array string
  status: text("status", { enum: ["OPPORTUNITY", "TARGETING", "RANKING", "WON"] }).default("OPPORTUNITY"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("keyword_client_idx").on(t.clientId),
]);

// ─── SEO Strategies ───────────────────────────────────────────────────────────

export const seoStrategies = sqliteTable("seo_strategies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // JSON: array of { id, title, content (rich text HTML), order }
  sections: text("sections").notNull().default("[]"),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }).default("DRAFT"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── Monthly Reports ──────────────────────────────────────────────────────────

export const monthlyReports = sqliteTable("monthly_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  title: text("title").notNull(),
  // Predefined sections JSON:
  // { executiveSummary, trafficOverview, keywordRankings, backlinkProfile, aiVisibility, wins, opportunities, nextMonthGoals }
  // Each section has: { adminNotes (rich text), autoData (pulled from integrations) }
  sections: text("sections").notNull().default("{}"),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }).default("DRAFT"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("unique_client_month_year").on(t.clientId, t.month, t.year),
]);

// ─── AI Visibility (manual + aggregated) ─────────────────────────────────────

export const aiVisibility = sqliteTable("ai_visibility", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  overallScore: real("overall_score"), // 0-100 aggregated
  rankscaleScore: real("rankscale_score"),
  semrushScore: real("semrush_score"),
  totalPromptsTested: integer("total_prompts_tested").default(0),
  promptsVisible: integer("prompts_visible").default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ai_visibility_client_date_idx").on(t.clientId, t.date),
]);

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
