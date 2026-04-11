# Schema Migration Guide

## Overview

This migration transitions the portal from the old integration stack (Ahrefs + SEMrush) to the new stack (Moz + DataForSEO + Rankscale) with agency-level credential management.

**Migration scope:**
- Replace Ahrefs with Moz (domain metrics)
- Drop SEMrush entirely (AI visibility now handled by Rankscale only)
- Introduce `apiCredentials` table for agency-level credentials
- Introduce `syncJobs` table for sync history and retry logic
- Simplify `dataSources` table (remove per-client credentials)
- Add `lastEnrichedAt` to `keyword_research` for incremental enrichment

## Current State (Before Migration)

**Integration stack:**
- GA4 (traffic)
- GSC (search queries)
- Ahrefs (domain metrics)
- Rankscale (AI visibility — stub)
- SEMrush (AI visibility — stub)

**Database tables:**
- `dataSources.type` enum: `GA4|GSC|AHREFS|RANKSCALE|SEMRUSH`
- `ahrefs_metrics` table with columns: `domainRating`, `urlRating`, `backlinks`, `referringDomains`, `organicKeywords`, `organicTraffic`
- `semrush_metrics` table (AI visibility data)
- `ai_visibility` table with column `semrushScore`
- `dataSources` has: `credentialsEnc`, `accessToken`, `refreshToken`, `tokenExpiresAt`, `propertyId`, `siteUrl`
- No `apiCredentials` table
- No `syncJobs` table
- `keyword_research` has no `lastEnrichedAt` column

## Target State (After Migration)

**Integration stack:**
- GA4 (traffic)
- GSC (search queries)
- Moz (domain metrics — replaces Ahrefs)
- DataForSEO (keyword enrichment — new)
- Rankscale (AI visibility — only provider)

**Database tables:**
- `dataSources.type` enum: `GA4|GSC|MOZ|DATAFORSEO|RANKSCALE`
- `moz_metrics` table (renamed from `ahrefs_metrics`) with columns: `domainAuthority`, `pageAuthority`, `spamScore`, `brandAuthority`, `backlinks`, `referringDomains`, `organicKeywords`, `organicTraffic`
- `semrush_metrics` table **dropped**
- `ai_visibility` table with column `secondaryScore` (renamed from `semrushScore`, always NULL)
- `dataSources` simplified: only `propertyIdentifier`, `isConnected`, `lastSyncedAt`, `lastSyncError`
- New `api_credentials` table for agency-level credentials
- New `sync_jobs` table for sync history
- `keyword_research` has `lastEnrichedAt` column

## All Changes with Rationale

### Change 1: `dataSources.type` Enum

**Before:**
```typescript
type: text("type").notNull().$type<"GA4" | "GSC" | "AHREFS" | "RANKSCALE" | "SEMRUSH">()
```

**After:**
```typescript
type: text("type").notNull().$type<"GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE">()
```

**Removed:** `AHREFS` (replaced by `MOZ`), `SEMRUSH` (dropped entirely)

**Added:** `MOZ`, `DATAFORSEO`

**Rationale:**
- Moz provides equivalent domain metrics to Ahrefs with better pricing
- DataForSEO provides keyword enrichment (new capability)
- SEMrush AI visibility dropped — Rankscale is the sole AI visibility provider

### Change 2: Rename `ahrefs_metrics` → `moz_metrics`

**New schema:**
```typescript
export const mozMetrics = sqliteTable("moz_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  domainAuthority: integer("domain_authority"), // 0-100 (was domainRating)
  pageAuthority: integer("page_authority"), // 0-100 (was urlRating)
  spamScore: integer("spam_score"), // 0-100 (new)
  brandAuthority: integer("brand_authority"), // 0-100 (new)
  backlinks: integer("backlinks").default(0),
  referringDomains: integer("referring_domains").default(0),
  organicKeywords: integer("organic_keywords").default(0),
  organicTraffic: integer("organic_traffic").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueClientDate: unique().on(table.clientId, table.date),
}));
```

**Column mapping from `ahrefs_metrics`:**

| ahrefs_metrics column | moz_metrics column | Migration action |
|---|---|---|
| `domainRating` | `domainAuthority` | Direct copy (both 0-100 scale) |
| `urlRating` | `pageAuthority` | Direct copy (both 0-100 scale) |
| `backlinks` | `backlinks` | Keep as-is |
| `referringDomains` | `referringDomains` | Keep as-is |
| `organicKeywords` | `organicKeywords` | Keep as-is |
| `organicTraffic` | `organicTraffic` | Keep as-is |
| — | `spamScore` | Set to NULL (new column, no historical data) |
| — | `brandAuthority` | Set to NULL (new column, no historical data) |

**Rationale:**
- Preserves historical domain metrics data
- Moz's Domain Authority is conceptually equivalent to Ahrefs' Domain Rating
- Moz's Page Authority is conceptually equivalent to Ahrefs' URL Rating
- New Moz-specific metrics (spam score, brand authority) will populate on first sync

### Change 3: `ai_visibility.semrushScore` → `secondaryScore`

**Before:**
```typescript
semrushScore: integer("semrush_score"),
```

**After:**
```typescript
secondaryScore: integer("secondary_score"),
```

**Migration action:**
- Rename column
- Set all existing values to `NULL` (SEMrush data dropped)

**Rationale:**
- SEMrush integration dropped — Rankscale is the sole AI visibility provider
- `secondaryScore` reserved for a future second AI visibility provider
- `overallScore` currently equals `rankscaleScore` (no averaging)

### Change 4: New `api_credentials` Table

**Schema:**
```typescript
export const apiCredentials = sqliteTable("api_credentials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull().$type<"GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE">(),
  credentialsEnc: text("credentials_enc").notNull(), // JSON string (encrypted in production)
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueProvider: unique().on(table.provider),
}));
```

**Credential JSON formats per provider:**

| Provider | JSON format |
|---|---|
| `GA4` | `{ "serviceAccountEmail": "...", "privateKey": "..." }` |
| `GSC` | `{ "serviceAccountEmail": "...", "privateKey": "..." }` |
| `MOZ` | `{ "accessId": "...", "secretKey": "..." }` |
| `DATAFORSEO` | `{ "login": "...", "password": "..." }` |
| `RANKSCALE` | `{ "apiKey": "..." }` |

**Rationale:**
- Agency-level credentials shared across all clients
- Simplifies `dataSources` table (no per-client credentials)
- Single source of truth for API credentials
- Easier credential rotation (update once, applies to all clients)

### Change 5: New `sync_jobs` Table

**Schema:**
```typescript
export const syncJobs = sqliteTable("sync_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  source: text("source").notNull().$type<"GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE">(),
  status: text("status").notNull().default("PENDING").$type<"PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "FAILED_PERMANENT">(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  rowsInserted: integer("rows_inserted"),
  error: text("error"),
  triggeredBy: text("triggered_by").notNull().default("MANUAL").$type<"MANUAL" | "SCHEDULER" | "API">(),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Index for efficient queries
CREATE INDEX sync_jobs_client_source_idx ON sync_jobs(client_id, source, created_at DESC);
```

**Status flow:**
```
PENDING → RUNNING → SUCCESS
                  → FAILED → (retry) → SUCCESS
                                     → FAILED → (retry) → FAILED_PERMANENT
```

**Rationale:**
- Track sync history for debugging and monitoring
- Enable retry logic for transient failures
- Distinguish manual vs scheduled syncs
- Show sync status in admin UI

### Change 6: Simplify `dataSources` Table

**Columns removed:**
- `credentialsEnc` — moved to `apiCredentials` table
- `accessToken` — moved to `apiCredentials` table
- `refreshToken` — moved to `apiCredentials` table
- `tokenExpiresAt` — moved to `apiCredentials` table
- `propertyId` — replaced by `propertyIdentifier`
- `siteUrl` — replaced by `propertyIdentifier`

**Column added:**
- `propertyIdentifier` TEXT — stores GA4 property ID or GSC site URL

**New schema:**
```typescript
export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<"GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE">(),
  propertyIdentifier: text("property_identifier"), // GA4: property ID, GSC: site URL, others: NULL
  isConnected: integer("is_connected", { mode: "boolean" }).notNull().default(false),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  lastSyncError: text("last_sync_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueClientType: unique().on(table.clientId, table.type),
}));
```

**Rationale:**
- Per-client config is now just the property identifier (GA4/GSC only)
- Moz, DataForSEO, Rankscale use agency-level credentials only
- Simpler data model — fewer columns to manage

### Change 7: Add `keyword_research.lastEnrichedAt`

**New column:**
```typescript
lastEnrichedAt: integer("last_enriched_at", { mode: "timestamp" }),
```

**Purpose:** Track when each keyword was last enriched with DataForSEO data

**Usage:**
- `NULL` = never enriched (enrich on next sync)
- Set to current timestamp after successful enrichment
- Re-enrich if `lastEnrichedAt < NOW() - 30 days`

**Rationale:**
- Enables incremental enrichment (cost control)
- Avoids re-fetching search volume for unchanged keywords
- Reduces DataForSEO API costs by ~80-90% after initial enrichment

## Migration Execution Order — 4 Phases

### Phase 1: Additive Changes (Safe, No Data Loss)

> ✅ These changes are safe to run in any order. No data is deleted.

```bash
# 1. Update schema.ts with new tables and columns
# 2. Generate migration SQL
bun run db:generate

# 3. Review generated SQL in ./drizzle/migrations/
# 4. Apply migrations
bun run db:migrate
```

**Changes in this phase:**
1. Create `api_credentials` table
2. Create `sync_jobs` table
3. Create `moz_metrics` table (empty, ready for data)
4. Add `property_identifier` column to `data_sources`
5. Add `last_enriched_at` column to `keyword_research`

### Phase 2: Data Migration

> ⚠️ **BACKUP DATABASE FIRST**

```bash
# Backup before data migration
cp ./data/portal.db ./data/portal.db.backup-pre-migration
```

**Step 1: Copy Ahrefs data to Moz table**

```sql
INSERT INTO moz_metrics (
  id,
  client_id,
  date,
  domain_authority,
  page_authority,
  backlinks,
  referring_domains,
  organic_keywords,
  organic_traffic,
  created_at
)
SELECT
  id,
  client_id,
  date,
  domain_rating,      -- → domain_authority
  url_rating,         -- → page_authority
  backlinks,
  referring_domains,
  organic_keywords,
  organic_traffic,
  created_at
FROM ahrefs_metrics;
```

**Step 2: Migrate Rankscale API keys to `api_credentials`**

```sql
-- Extract Rankscale credentials from data_sources
INSERT INTO api_credentials (id, provider, credentials_enc, is_active, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  'RANKSCALE',
  credentials_enc,
  1,
  unixepoch(),
  unixepoch()
FROM data_sources
WHERE type = 'RANKSCALE'
  AND credentials_enc IS NOT NULL
LIMIT 1; -- Only one agency-level credential needed
```

**Step 3: Set `ai_visibility.secondary_score` to NULL**

```sql
UPDATE ai_visibility SET secondary_score = NULL;
```

**Step 4: Verify data migration**

```bash
# Check row counts match
sqlite3 ./data/portal.db "SELECT COUNT(*) FROM ahrefs_metrics;"
sqlite3 ./data/portal.db "SELECT COUNT(*) FROM moz_metrics;"

# Verify sample data
sqlite3 ./data/portal.db "SELECT client_id, date, domain_authority, page_authority FROM moz_metrics LIMIT 5;"
```

### Phase 3: Destructive Changes (After Verifying Phase 2)

> ⚠️ **POINT OF NO RETURN** — Verify Phase 2 data migration before proceeding.

```sql
-- Drop old tables
DROP TABLE ahrefs_metrics;
DROP TABLE semrush_metrics;

-- Remove old columns from data_sources
-- SQLite doesn't support DROP COLUMN directly — must recreate table
-- This is handled by Drizzle migration generator
```

**Update `data_sources.type` enum constraint:**
- Remove `AHREFS`, `SEMRUSH`
- Add `MOZ`, `DATAFORSEO`

### Phase 4: TypeScript Updates

**Update `src/lib/db/schema.ts`:**

1. Rename `ahrefsMetrics` export → `mozMetrics`
2. Update column names in `mozMetrics` table definition
3. Update `dataSources.type` enum
4. Add `apiCredentials` table definition
5. Add `syncJobs` table definition
6. Update type exports at bottom of file

**Example:**
```typescript
// Before
export const ahrefsMetrics = sqliteTable("ahrefs_metrics", { ... });
export type AhrefsMetric = typeof ahrefsMetrics.$inferSelect;

// After
export const mozMetrics = sqliteTable("moz_metrics", { ... });
export type MozMetric = typeof mozMetrics.$inferSelect;
```

**Generate and apply final migration:**
```bash
bun run db:generate
bun run db:migrate
```

**Verify in Drizzle Studio:**
```bash
bun run db:studio
```

## Rollback Strategy

**Before Phase 3 (destructive changes):**
```bash
# Backup database
cp ./data/portal.db ./data/portal.db.backup-pre-migration
```

**To rollback:**
```bash
# Restore backup
cp ./data/portal.db.backup-pre-migration ./data/portal.db

# Restart dev server
bun run dev
```

**After Phase 3:**
Rollback is not possible without data loss. Ensure Phase 2 data migration is verified before proceeding to Phase 3.

## Post-Migration Verification

**Check all tables exist:**
```bash
sqlite3 ./data/portal.db ".tables"
# Should include: api_credentials, sync_jobs, moz_metrics
# Should NOT include: ahrefs_metrics, semrush_metrics
```

**Check data_sources enum:**
```bash
sqlite3 ./data/portal.db "SELECT DISTINCT type FROM data_sources;"
# Should return: GA4, GSC, MOZ, DATAFORSEO, RANKSCALE
```

**Check moz_metrics data:**
```bash
sqlite3 ./data/portal.db "SELECT COUNT(*) FROM moz_metrics;"
# Should match original ahrefs_metrics count
```

**Check api_credentials:**
```bash
sqlite3 ./data/portal.db "SELECT provider, is_active FROM api_credentials;"
# Should show all 5 providers (after admin configures them)
```

## Commands Reference

```bash
# Generate migration SQL from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio to verify changes
bun run db:studio

# Backup database
cp ./data/portal.db ./data/portal.db.backup-$(date +%Y%m%d-%H%M%S)

# Restore backup
cp ./data/portal.db.backup-YYYYMMDD-HHMMSS ./data/portal.db
```

## Timeline Estimate

| Phase | Duration | Can run in production? |
|---|---|---|
| Phase 1: Additive changes | 5 minutes | ✅ Yes — no breaking changes |
| Phase 2: Data migration | 10 minutes | ✅ Yes — old tables still exist |
| Phase 3: Destructive changes | 5 minutes | ⚠️ Downtime required |
| Phase 4: TypeScript updates | 10 minutes | ⚠️ Downtime required |
| **Total** | **30 minutes** | **Plan for 1-hour maintenance window** |

## Next Steps After Migration

1. **Configure API credentials** — `/admin/settings/api-credentials`
2. **Update integration files** — `src/lib/integrations/moz.ts`, `dataforseo.ts`
3. **Test syncs** — trigger manual sync for one client per source
4. **Monitor sync_jobs table** — verify status transitions
5. **Enable weekly scheduler** — deploy `vercel.json` with cron config
