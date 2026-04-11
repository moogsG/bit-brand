# Integration Architecture Overview

Comprehensive guide to the data integration stack for the BIT Brand Anarchy SEO Client Portal.

---

## Why This Stack

**Cost comparison:**

| Approach | Monthly Cost |
|----------|--------------|
| **Ahrefs Standard** | $449/mo |
| **This Stack** | ~$85-95/mo + Rankscale TBD |
| **Savings** | ~$350-360/mo (~78% reduction) |

**What we gain:**
- **GA4 + GSC:** Free, authoritative traffic and search data directly from Google
- **Moz:** Industry-standard Domain Authority metric, trusted by clients
- **DataForSEO:** Pay-as-you-go keyword data, only enrich what we need
- **Rankscale:** AI search visibility tracking (ChatGPT, Perplexity, Gemini) — a differentiator Ahrefs doesn't offer

**What we trade off:**
- **Ahrefs backlink index:** Moz's backlink index is smaller but sufficient for most clients
- **All-in-one dashboard:** We build our own (which is the point of this portal)
- **Keyword difficulty:** DataForSEO provides this, but Ahrefs' proprietary metric is more refined

**Verdict:** For a white-label client portal where we control the UX and can showcase AI visibility as a premium feature, this stack delivers better ROI.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL APIs                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │ GA4 API  │  │ GSC API  │  │ Moz API  │  │DataForSEO│  │Rank- │ │
│  │   $0     │  │   $0     │  │  $75/mo  │  │ ~$15/mo  │  │scale │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬──┘ │
│       │             │             │             │            │    │
└───────┼─────────────┼─────────────┼─────────────┼────────────┼────┘
        │             │             │             │            │
        ▼             ▼             ▼             ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SYNC FUNCTIONS                                 │
│  src/lib/integrations/                                              │
│  ├── ga4.ts          syncGA4Data()                                  │
│  ├── gsc.ts          syncGSCData()                                  │
│  ├── moz.ts          syncMozData()                                  │
│  ├── dataforseo.ts   syncDataForSEOData()                           │
│  └── rankscale.ts    syncRankscaleData()                            │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE (SQLite)                              │
│  ./data/portal.db                                                   │
│  ├── apiCredentials       (agency-level API keys)                   │
│  ├── dataSources          (per-client config)                       │
│  ├── ga4Metrics           (daily traffic data)                      │
│  ├── gscMetrics           (search query data)                       │
│  ├── mozMetrics           (domain authority, backlinks)             │
│  ├── keywordResearch      (keyword list + enrichment)               │
│  ├── rankscaleMetrics     (AI visibility per prompt)                │
│  ├── aiVisibility         (aggregated AI scores)                    │
│  └── syncJobs             (sync history + retry tracking)           │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   NEXT.JS PORTAL                                    │
│  src/app/                                                           │
│  ├── admin/              (admin dashboard, sync controls)           │
│  └── portal/[clientSlug]/ (client dashboard, reports, AI visibility)│
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        ▼
                   ┌─────────┐
                   │ CLIENTS │
                   └─────────┘
```

---

## Integration Summary

| Provider | Auth Method | Cost | Data Provided | Dashboard Features | File Location |
|----------|-------------|------|---------------|-------------------|---------------|
| **GA4** | Google Service Account (OAuth 2.0) | $0 | Sessions, users, pageviews, bounce rate, avg session duration, organic sessions | Traffic KPI cards, traffic chart | `src/lib/integrations/ga4.ts` |
| **GSC** | Google Service Account (OAuth 2.0) | $0 | Search queries, clicks, impressions, CTR, position | Search performance chart, top keywords table | `src/lib/integrations/gsc.ts` |
| **Moz** | API Key | $75/mo | Domain Authority, Page Authority, backlinks, referring domains, spam score | Domain Authority KPI card, backlink profile section in reports | `src/lib/integrations/moz.ts` |
| **DataForSEO** | API Key | ~$10-20/mo | Keyword volume, difficulty, SERP positions, CPC | Keyword research table enrichment, keyword rankings section in reports | `src/lib/integrations/dataforseo.ts` |
| **Rankscale** | API Key | TBD | AI visibility per prompt (ChatGPT, Perplexity, Gemini), position, response snippet | AI visibility KPI card, AI visibility trend chart, prompt results table | `src/lib/integrations/rankscale.ts` |

---

## Credential Architecture

This portal uses a **two-tier credential system** to separate agency-level API keys from per-client configuration.

### Tier 1: Agency-Level Credentials (`apiCredentials` table)

**Purpose:** Store API keys and service account credentials that are shared across all clients.

**Schema:**
```typescript
{
  id: string;              // UUID
  provider: string;        // "GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE"
  credentialsEnc: string;  // Encrypted JSON: { apiKey, serviceAccountEmail, privateKey, etc. }
  isActive: boolean;       // Whether this credential is currently in use
  createdAt: Date;
  updatedAt: Date;
}
```

**Example records:**
- `provider: "GA4"` → `credentialsEnc: { serviceAccountEmail, privateKey }`
- `provider: "MOZ"` → `credentialsEnc: { accessId, secretKey }`
- `provider: "DATAFORSEO"` → `credentialsEnc: { login, password }`
- `provider: "RANKSCALE"` → `credentialsEnc: { apiKey }`

**Who manages:** Admin only. Credentials are set once during initial setup and rarely changed.

**Encryption:** All `credentialsEnc` values are encrypted using AES-256-GCM with the `ENCRYPTION_KEY` environment variable.

### Tier 2: Per-Client Configuration (`dataSources` table)

**Purpose:** Store which integrations are enabled for each client and client-specific identifiers (GA4 property ID, GSC site URL).

**Schema:**
```typescript
{
  id: string;              // UUID
  clientId: string;        // FK to clients.id
  type: string;            // "GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE"
  isConnected: boolean;    // Whether this source is enabled for this client
  propertyId: string;      // GA4 property ID (e.g., "properties/123456789")
  siteUrl: string;         // GSC site URL (e.g., "https://example.com/")
  lastSyncedAt: Date;      // Timestamp of last successful sync
  lastSyncError: string;   // Error message from last failed sync (null if success)
  createdAt: Date;
  updatedAt: Date;
}
```

**Example records:**
- Client A: `type: "GA4"`, `isConnected: true`, `propertyId: "properties/123456789"`
- Client A: `type: "GSC"`, `isConnected: true`, `siteUrl: "https://clienta.com/"`
- Client B: `type: "GA4"`, `isConnected: false` (not enabled)

**Who manages:** Admin via the client detail page (`/admin/clients/[id]`).

**Unique constraint:** One record per `(clientId, type)` pair.

### How They Work Together

When a sync function runs:

1. **Read agency credential:** `SELECT * FROM apiCredentials WHERE provider = 'GA4' AND isActive = true`
2. **Decrypt credential:** Use `ENCRYPTION_KEY` to decrypt `credentialsEnc`
3. **Read client config:** `SELECT * FROM dataSources WHERE clientId = ? AND type = 'GA4'`
4. **Check if enabled:** If `isConnected = false`, skip sync
5. **Extract client-specific ID:** Use `propertyId` or `siteUrl` from `dataSources`
6. **Call API:** Use agency credential + client-specific ID
7. **Store results:** Insert/upsert into metrics table
8. **Update sync status:** Set `lastSyncedAt` or `lastSyncError` in `dataSources`

---

## SyncResult Type

All sync functions return a standardized `SyncResult` object:

```typescript
interface SyncResult {
  success: boolean;        // true if sync completed without fatal errors
  rowsInserted: number;    // Number of rows inserted/updated in the metrics table
  error?: string;          // Error message if success = false
  source: string;          // "GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE"
}
```

### Field Meanings

**`success`**
- `true`: Sync completed successfully, data was inserted
- `false`: Sync failed due to API error, auth error, or missing config

**`rowsInserted`**
- Count of rows inserted or updated in the metrics table
- For upsert operations (GA4, Moz), this is the number of unique date records processed
- For insert operations (GSC, Rankscale), this is the total number of rows inserted
- `0` if no new data was available (e.g., already up-to-date)

**`error`**
- Only present if `success = false`
- Human-readable error message stored in `dataSources.lastSyncError`
- Examples: `"Invalid API key"`, `"Property not found"`, `"Rate limit exceeded"`

**`source`**
- Identifies which integration this result came from
- Used for logging and UI display in the admin sync controls

### Example Usage

```typescript
// In src/lib/integrations/ga4.ts
export async function syncGA4Data(clientId: string): Promise<SyncResult> {
  try {
    // ... fetch and insert data
    return {
      success: true,
      rowsInserted: 90,
      source: "GA4",
    };
  } catch (error) {
    return {
      success: false,
      rowsInserted: 0,
      error: error.message,
      source: "GA4",
    };
  }
}

// In API route
const result = await syncGA4Data(clientId);
if (!result.success) {
  // Update dataSources.lastSyncError
  await db.update(dataSources)
    .set({ lastSyncError: result.error })
    .where(eq(dataSources.clientId, clientId));
}
```

---

## Sync Trigger Methods

### 1. Manual Sync (Admin UI)

**Location:** `/admin/clients/[id]` → Sync Controls section

**Component:** `src/components/admin/sync-controls.tsx`

**Buttons:**
- **"Sync Now"** per source → `POST /api/sync/[clientId]/[source]`
- **"Sync All"** → `POST /api/sync/[clientId]`

**Flow:**
1. Admin clicks "Sync Now" for GA4
2. `POST /api/sync/[clientId]/GA4` is called
3. API route calls `syncGA4Data(clientId)`
4. `SyncResult` is returned and displayed in the UI
5. `dataSources.lastSyncedAt` is updated
6. Sync status panel refreshes

### 2. API Trigger

**Endpoints:**
- `POST /api/sync/[clientId]` — sync all connected sources for a client
- `POST /api/sync/[clientId]/[source]` — sync a single source

**Authentication:** Requires `ADMIN` role (enforced in `src/proxy.ts`)

**Example:**
```bash
# Sync all sources for a client
curl -X POST http://localhost:3000/api/sync/abc-123-client-id \
  -H "Cookie: authjs.session-token=..."

# Sync only GA4
curl -X POST http://localhost:3000/api/sync/abc-123-client-id/GA4 \
  -H "Cookie: authjs.session-token=..."
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "success": true, "rowsInserted": 90, "source": "GA4" },
    { "success": true, "rowsInserted": 1000, "source": "GSC" },
    { "success": false, "rowsInserted": 0, "error": "Invalid API key", "source": "MOZ" }
  ]
}
```

### 3. Scheduled Sync (Vercel Cron)

**Schedule:** Weekly on Monday at 2:00 AM UTC (`0 2 * * 1`)

**Endpoint:** `POST /api/cron/weekly-sync`

**Authentication:** Requires `CRON_SECRET` header to match `process.env.CRON_SECRET`

**Flow:**
1. Vercel Cron triggers `POST /api/cron/weekly-sync` with `Authorization: Bearer {CRON_SECRET}`
2. API route validates the secret
3. Fetches all active clients from the database
4. For each client, calls `POST /api/sync/[clientId]` internally
5. Logs results to `syncJobs` table
6. Returns summary of all sync results

**Configuration:** `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-sync",
      "schedule": "0 2 * * 1"
    }
  ]
}
```

> ✅ **ACTION REQUIRED:** Set `CRON_SECRET` in production environment variables before deploying.

---

## Sync Function Pattern

All sync functions follow a standardized pattern to ensure consistency and maintainability.

### Standard Pattern

```typescript
// src/lib/integrations/example.ts
import { db } from "@/lib/db";
import { apiCredentials, dataSources, exampleMetrics } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import type { SyncResult } from "./types";

export async function syncExampleData(clientId: string): Promise<SyncResult> {
  try {
    // Step 1: Read agency-level credential
    const [credential] = await db
      .select()
      .from(apiCredentials)
      .where(and(
        eq(apiCredentials.provider, "EXAMPLE"),
        eq(apiCredentials.isActive, true)
      ))
      .limit(1);

    if (!credential) {
      return {
        success: false,
        rowsInserted: 0,
        error: "No active EXAMPLE credential found",
        source: "EXAMPLE",
      };
    }

    // Step 2: Decrypt credential
    const creds = JSON.parse(decrypt(credential.credentialsEnc));
    const { apiKey } = creds;

    // Step 3: Read per-client config
    const [dataSource] = await db
      .select()
      .from(dataSources)
      .where(and(
        eq(dataSources.clientId, clientId),
        eq(dataSources.type, "EXAMPLE")
      ))
      .limit(1);

    if (!dataSource) {
      return {
        success: false,
        rowsInserted: 0,
        error: "EXAMPLE not configured for this client",
        source: "EXAMPLE",
      };
    }

    // Step 4: Check if enabled
    if (!dataSource.isConnected) {
      return {
        success: false,
        rowsInserted: 0,
        error: "EXAMPLE is not enabled for this client",
        source: "EXAMPLE",
      };
    }

    // Step 5: Call external API
    const response = await fetch(`https://api.example.com/data`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Step 6: Transform and insert data
    let rowsInserted = 0;
    for (const item of data.items) {
      await db.insert(exampleMetrics).values({
        clientId,
        date: item.date,
        metric1: item.value1,
        metric2: item.value2,
      }).onConflictDoUpdate({
        target: [exampleMetrics.clientId, exampleMetrics.date],
        set: {
          metric1: item.value1,
          metric2: item.value2,
        },
      });
      rowsInserted++;
    }

    // Step 7: Update sync status
    await db.update(dataSources)
      .set({
        lastSyncedAt: new Date(),
        lastSyncError: null,
      })
      .where(eq(dataSources.id, dataSource.id));

    // Step 8: Return success
    return {
      success: true,
      rowsInserted,
      source: "EXAMPLE",
    };

  } catch (error) {
    // Step 9: Handle errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update error status
    const [dataSource] = await db
      .select()
      .from(dataSources)
      .where(and(
        eq(dataSources.clientId, clientId),
        eq(dataSources.type, "EXAMPLE")
      ))
      .limit(1);

    if (dataSource) {
      await db.update(dataSources)
        .set({ lastSyncError: errorMessage })
        .where(eq(dataSources.id, dataSource.id));
    }

    return {
      success: false,
      rowsInserted: 0,
      error: errorMessage,
      source: "EXAMPLE",
    };
  }
}
```

### Pattern Checklist

- [ ] Read agency credential from `apiCredentials` table
- [ ] Decrypt credential using `decrypt()` from `@/lib/crypto`
- [ ] Read per-client config from `dataSources` table
- [ ] Check `isConnected` flag before proceeding
- [ ] Call external API with decrypted credentials
- [ ] Transform API response to match DB schema
- [ ] Insert/upsert data into metrics table
- [ ] Update `dataSources.lastSyncedAt` on success
- [ ] Update `dataSources.lastSyncError` on failure
- [ ] Return `SyncResult` object
- [ ] Wrap entire function in try/catch
- [ ] Log errors for debugging

---

## Error Handling Philosophy

### Partial Failures Are Acceptable

**Principle:** If we can insert some data, we do. We don't fail the entire sync because one record is malformed.

**Example:** GSC returns 1000 query records. Record 500 has a null `query` field (invalid). We insert records 1-499 and 501-1000, log the error for record 500, and return `success: true, rowsInserted: 999`.

**Implementation:**
```typescript
let rowsInserted = 0;
let errors = [];

for (const item of data.items) {
  try {
    await db.insert(gscMetrics).values({
      clientId,
      date: item.date,
      query: item.query,
      clicks: item.clicks,
    });
    rowsInserted++;
  } catch (error) {
    errors.push({ item, error: error.message });
  }
}

if (errors.length > 0) {
  console.error(`GSC sync partial failure: ${errors.length} records failed`, errors);
}

return {
  success: rowsInserted > 0,
  rowsInserted,
  error: errors.length > 0 ? `${errors.length} records failed` : undefined,
  source: "GSC",
};
```

### Error Storage

**`dataSources.lastSyncError`**
- Stores the most recent error message for a data source
- Displayed in the admin sync controls UI
- Cleared on next successful sync (`lastSyncError: null`)

**`syncJobs` table**
- Tracks every sync attempt with full details
- Schema:
  ```typescript
  {
    id: string;
    clientId: string;
    source: string;
    status: "SUCCESS" | "PARTIAL" | "FAILED";
    rowsInserted: number;
    errorMessage: string;
    startedAt: Date;
    completedAt: Date;
  }
  ```
- Used for debugging, retry logic, and sync history reporting

### Retry Logic

**Not implemented yet.** Planned approach:

1. `syncJobs` table tracks failed syncs
2. Cron job runs daily to retry failed syncs from the last 7 days
3. Exponential backoff: retry after 1 hour, 4 hours, 24 hours
4. After 3 failed retries, mark as "NEEDS_ATTENTION" and alert admin

---

## Adding a New Integration

Follow this checklist to add a new data source to the portal.

### Step 1: Add Provider to Schema

**File:** `src/lib/db/schema.ts`

Add the new provider to the `apiCredentials.provider` enum and `dataSources.type` enum:

```typescript
export const apiCredentials = sqliteTable("api_credentials", {
  // ...
  provider: text("provider").notNull(), // Add "NEWPROVIDER" to docs
});

export const dataSources = sqliteTable("data_sources", {
  // ...
  type: text("type").notNull(), // Add "NEWPROVIDER" to docs
});
```

Run migrations:
```bash
bun run db:generate
bun run db:migrate
```

### Step 2: Create Metrics Table

**File:** `src/lib/db/schema.ts`

Define the new metrics table:

```typescript
export const newProviderMetrics = sqliteTable("new_provider_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD format
  metric1: integer("metric1"),
  metric2: real("metric2"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  clientDateIdx: uniqueIndex("new_provider_client_date_idx").on(table.clientId, table.date),
}));

export type NewProviderMetric = typeof newProviderMetrics.$inferSelect;
export type NewNewProviderMetric = typeof newProviderMetrics.$inferInsert;
```

Run migrations:
```bash
bun run db:generate
bun run db:migrate
```

### Step 3: Create Sync Function

**File:** `src/lib/integrations/newprovider.ts`

Follow the [standard pattern](#sync-function-pattern):

```typescript
import { db } from "@/lib/db";
import { apiCredentials, dataSources, newProviderMetrics } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import type { SyncResult } from "./types";

export async function syncNewProviderData(clientId: string): Promise<SyncResult> {
  // Follow the 9-step pattern from above
}
```

### Step 4: Add API Route

**File:** `src/app/api/sync/[clientId]/[source]/route.ts`

Add the new provider to the switch statement:

```typescript
import { syncNewProviderData } from "@/lib/integrations/newprovider";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; source: string }> }
) {
  const { clientId, source } = await params;

  let result: SyncResult;
  switch (source.toUpperCase()) {
    case "GA4":
      result = await syncGA4Data(clientId);
      break;
    case "NEWPROVIDER":
      result = await syncNewProviderData(clientId);
      break;
    // ... other cases
    default:
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  return NextResponse.json(result);
}
```

### Step 5: Add Admin UI Form

**File:** `src/components/admin/data-source-form.tsx`

Add a form section for the new provider:

```typescript
{dataSource.type === "NEWPROVIDER" && (
  <>
    <div>
      <Label htmlFor="apiKey">API Key</Label>
      <Input
        id="apiKey"
        type="password"
        value={credentials.apiKey || ""}
        onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
      />
    </div>
    <div>
      <Label htmlFor="projectId">Project ID</Label>
      <Input
        id="projectId"
        value={credentials.projectId || ""}
        onChange={(e) => setCredentials({ ...credentials, projectId: e.target.value })}
      />
    </div>
  </>
)}
```

### Step 6: Add to Sync Controls

**File:** `src/components/admin/sync-controls.tsx`

Add the new provider to the list of sources:

```typescript
const sources = ["GA4", "GSC", "MOZ", "DATAFORSEO", "RANKSCALE", "NEWPROVIDER"];
```

### Step 7: Update Documentation

Add the new provider to:
- This file (`docs/integrations/overview.md`) — integration summary table
- `AGENTS.md` — integration stack section
- `README.md` — integration stack table

### Step 8: Test

1. Add agency credential to `apiCredentials` table via Drizzle Studio
2. Configure client data source via admin UI (`/admin/clients/[id]`)
3. Trigger manual sync via sync controls
4. Verify data appears in the new metrics table
5. Check `dataSources.lastSyncedAt` is updated
6. Test error handling by providing invalid credentials

---

## Integration-Specific Notes

### GA4

**Endpoint:** `https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport`

**Auth:** Google Service Account (OAuth 2.0)

**Credential format:**
```json
{
  "serviceAccountEmail": "portal@project.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

**Date format gotcha:** GA4 API returns dates as `YYYYMMDD` — convert to `YYYY-MM-DD` before inserting.

**Metrics fetched:**
- `sessions`, `totalUsers`, `newUsers`, `screenPageViews`
- `bounceRate`, `averageSessionDuration`
- `organicGoogleSearchSessions` (organic traffic)

**Dimensions:** `date` (last 90 days)

### GSC

**Endpoint:** `https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query`

**Auth:** Google Service Account (OAuth 2.0)

**Credential format:** Same as GA4 (shared service account)

**siteUrl format:** Must match exactly what's registered in GSC:
- `https://www.example.com/` (with trailing slash)
- `sc-domain:example.com` (domain property)

**Metrics fetched:**
- `clicks`, `impressions`, `ctr`, `position`

**Dimensions:** `[date, query]` (last 90 days, limit 1000 rows)

**Gotcha:** GSC API has a 25,000 row limit per request. For high-traffic sites, implement pagination.

### Moz

**Endpoint:** `https://lsapi.seomoz.com/v2/url_metrics`

**Auth:** Access ID + Secret Key (HTTP Basic Auth)

**Credential format:**
```json
{
  "accessId": "mozscape-abc123",
  "secretKey": "def456ghi789"
}
```

**Metrics fetched:**
- `domain_authority`, `page_authority`
- `external_pages_to_root_domain` (backlinks)
- `root_domains_to_root_domain` (referring domains)
- `spam_score`

**Rate limits:** 10 requests per 10 seconds (Growth Medium plan)

**Gotcha:** Moz API returns metrics as integers (0-100 for DA/PA). Store as integers, not floats.

### DataForSEO

**Endpoint:** `https://api.dataforseo.com/v3/keywords_data/google/search_volume/live`

**Auth:** Login + Password (HTTP Basic Auth)

**Credential format:**
```json
{
  "login": "user@example.com",
  "password": "password123"
}
```

**Metrics fetched:**
- `search_volume` (monthly volume)
- `keyword_difficulty`
- `cpc` (cost per click)
- `competition` (0-1 scale)

**Incremental enrichment:** Only enrich keywords where `lastEnrichedAt` is null or older than 30 days.

**Cost optimization:** Batch keywords into groups of 100 per API call (DataForSEO allows up to 1000 keywords per request).

**Gotcha:** DataForSEO returns `null` for search volume if the keyword has no data. Store as `null`, not `0`.

### Rankscale

**Endpoint:** ⚠️ **PLACEHOLDER** — `https://api.rankscale.io/v1/visibility`

> ⚠️ **WARNING:** This endpoint is unverified. Confirm with Rankscale API documentation before deploying.

**Auth:** API Key (header: `X-API-Key`)

**Credential format:**
```json
{
  "apiKey": "rsk_abc123def456"
}
```

**Metrics fetched:**
- `isVisible` (boolean)
- `position` (1-10 or null)
- `platform` (ChatGPT, Perplexity, Gemini)
- `responseSnippet` (text excerpt)
- `visibilityScore` (0-100)

**Prompt derivation:** Rankscale tests are triggered by prompts derived from the client's `keywordResearch` table. The sync function:
1. Fetches top 20 keywords by priority for the client
2. Converts each keyword into a natural language prompt (e.g., "best CRM software" → "What is the best CRM software?")
3. Sends prompts to Rankscale API
4. Stores results in `rankscaleMetrics` table

**Aggregate helper:** After inserting Rankscale metrics, call `updateAiVisibilityAggregate(clientId, date)` to update the `aiVisibility` table with the combined score.

**Gotcha:** Rankscale may return `isVisible: false` for all prompts if the brand is not mentioned. This is valid data — insert it.

---

## Verification with Axon

```bash
# See all integration files
axon_query "sync.*Data"

# See SyncResult usage
axon_context "SyncResult"

# See what depends on a specific integration
axon_impact "syncGA4Data"

# See credential encryption
axon_context "encrypt"
```

---

## Next Steps

1. **Set up agency credentials:** Add records to `apiCredentials` table for GA4, GSC, Moz, DataForSEO, Rankscale
2. **Encrypt credentials:** Implement `encrypt()` and `decrypt()` functions in `src/lib/crypto.ts` using `ENCRYPTION_KEY`
3. **Test each integration:** Manually trigger syncs via admin UI and verify data appears in metrics tables
4. **Set up Vercel Cron:** Configure `CRON_SECRET` and deploy `vercel.json`
5. **Monitor sync jobs:** Build admin dashboard to view `syncJobs` table and identify failed syncs
6. **Implement retry logic:** Add cron job to retry failed syncs with exponential backoff

---

**Last updated:** 2026-04-11
