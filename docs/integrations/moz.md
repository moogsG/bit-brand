# Moz API Integration

**Provider:** Moz (formerly SEOmoz)  
**Auth Method:** JSON-RPC 2.0 with Access ID + Secret Key  
**Implementation:** `src/lib/integrations/moz.ts` (new file)  
**Plan:** Growth Medium ($75/mo, 15,000 rows/month)

---

## Why Moz Over Ahrefs

### Cost Comparison

| Provider | Plan | Monthly Cost | Annual Cost |
|---|---|---|---|
| **Ahrefs** | Advanced | $449/mo | $5,388/year |
| **Moz** | Growth Medium | $75/mo | $900/year |
| **Savings** | — | **$374/mo** | **$4,488/year** |

### Feature Parity

| Feature | Ahrefs | Moz | Portal Requirement |
|---|---|---|---|
| Domain authority metric | Domain Rating (DR) | Domain Authority (DA) | ✅ DA more widely recognized |
| Backlinks count | ✅ | ✅ | ✅ |
| Referring domains | ✅ | ✅ | ✅ |
| Ranking keywords | ✅ | ✅ | ✅ |
| Keyword difficulty | ✅ | ✅ | ✅ |
| Brand authority | ❌ | ✅ | ✅ Bonus feature |

### Client Perception

- **Domain Authority (DA)** is more widely recognized by SMB clients than Ahrefs' Domain Rating (DR)
- DA has been the industry standard since 2004
- Easier to explain to non-technical clients

### Integration Simplicity

- Moz uses JSON-RPC 2.0 (simpler than Ahrefs Connect API)
- Single API key authentication (no OAuth)
- Well-documented endpoints with clear response schemas

---

## What It Provides

### Metrics

- **Domain Authority (DA):** 0-100 score predicting ranking ability
- **Page Authority (PA):** 0-100 score for individual pages
- **Spam Score:** 0-100 risk score for spammy signals
- **Brand Authority:** 0-100 score for brand strength
- **Backlinks:** Total number of backlinks
- **Referring Domains:** Total number of unique domains linking to the site
- **Ranking Keywords:** Keywords the domain ranks for (with positions, volume, difficulty)

### Powers These Features

| Feature | Location | Metric Used |
|---|---|---|
| Domain Authority KPI card | `/portal/[clientSlug]/dashboard` | `domainAuthority` |
| Backlink Profile section | Monthly reports | `backlinks`, `referringDomains` |
| Keyword research enrichment | `/admin/clients/[id]/keywords` | `currentPosition` from ranking keywords |
| Organic keywords count | Dashboard | Count of ranking keywords |
| Organic traffic estimate | Dashboard | Sum of estimated traffic from ranking keywords |

---

## Authentication

### JSON-RPC 2.0 with Access ID + Secret Key

**How it works:**
1. Agency signs up for Moz Growth Medium plan
2. Moz provides Access ID and Secret Key
3. Credentials stored once in `apiCredentials` table
4. No per-client credentials needed — agency-level only

### Credentials Storage

**Agency-level (`apiCredentials` table):**
```json
{
  "accessId": "mozscape-abc123def456",
  "secretKey": "1234567890abcdef1234567890abcdef"
}
```

**Per-client (`dataSources` table):**
- `type`: `"MOZ"`
- `propertyIdentifier`: Client domain (e.g. `acmecorp.com` — no protocol, no www)
- `isConnected`: `true` when configured
- `lastSyncedAt`: timestamp of last successful sync
- `lastSyncError`: error message if sync failed

### Base URL

```
https://lsapi.seomoz.com/v2/
```

### Authentication Header

Moz uses HTTP Basic Authentication with Access ID as username and Secret Key as password:

```typescript
const auth = Buffer.from(`${accessId}:${secretKey}`).toString('base64');
const headers = {
  'Authorization': `Basic ${auth}`,
  'Content-Type': 'application/json',
};
```

---

## Plan Details

### Growth Medium Plan

| Feature | Limit |
|---|---|
| **Price** | $75/month |
| **Rows per month** | 15,000 |
| **Overage cost** | $5 per 1,000 rows |
| **API access** | ✅ Full API access |
| **Keyword tracking** | 3,000 keywords |
| **Rank tracking** | Weekly |

### Row Budget Management

**Portal usage calculation:**
- 10 clients
- Per sync per client:
  - 1 row: `url_metrics` (DA, PA, Spam Score)
  - 1 row: `link_metrics` (Backlinks, Referring Domains)
  - 1 row: `brand_authority` (Brand Authority score)
  - 200 rows: `ranking_keywords` (capped at 200 keywords per client)
  - **Total per sync:** 203 rows
- 4 syncs per month (weekly)
- **Monthly total:** 203 × 4 × 10 = **8,120 rows/month**

> ✅ **8,120 rows/month < 15,000 limit.** Safe margin of 6,880 rows (46% headroom).

### Row Limit Configuration

**Constant in `src/lib/integrations/moz.ts`:**
```typescript
const MOZ_RANKING_KEYWORDS_LIMIT = 200;
```

**Rationale:**
- 200 keywords per client is sufficient for SMB clients
- Leaves headroom for growth (can increase to 300 if needed)
- Prevents single client from consuming entire monthly quota

### Quota Monitoring

**Warning threshold:** 90% of monthly limit (13,500 rows)

**Implementation:**
```typescript
// Track cumulative rows used this month
let monthlyRowsUsed = 0;

// After each sync
monthlyRowsUsed += syncResult.rowsInserted;

if (monthlyRowsUsed > 13500) {
  console.warn(`Moz API: 90% quota reached (${monthlyRowsUsed}/15,000 rows)`);
  // TODO: Send admin notification email
}
```

---

## API Endpoints

### 1. URL Metrics (Domain Authority, Page Authority, Spam Score)

**Endpoint:**
```
POST https://lsapi.seomoz.com/v2/url_metrics
```

**Request body:**
```json
{
  "targets": ["acmecorp.com"],
  "metrics": ["domain_authority", "page_authority", "spam_score"]
}
```

**Response:**
```json
{
  "results": [
    {
      "target": "acmecorp.com",
      "domain_authority": 42,
      "page_authority": 38,
      "spam_score": 3
    }
  ]
}
```

**Row cost:** 1 row per target

---

### 2. Link Metrics (Backlinks, Referring Domains)

**Endpoint:**
```
POST https://lsapi.seomoz.com/v2/link_metrics
```

**Request body:**
```json
{
  "target": "acmecorp.com",
  "scope": "domain_to_domain"
}
```

**Response:**
```json
{
  "target": "acmecorp.com",
  "external_pages": 1234,
  "external_root_domains": 567
}
```

**Row cost:** 1 row per target

**Scope options:**
- `domain_to_domain`: All backlinks to the domain
- `page_to_page`: Backlinks to a specific page
- `domain_to_page`: Domain-level backlinks to a specific page

**Portal uses:** `domain_to_domain` (domain-level metrics)

---

### 3. Brand Authority

**Endpoint:**
```
POST https://lsapi.seomoz.com/v2/brand_authority
```

**Request body:**
```json
{
  "target": "acmecorp.com"
}
```

**Response:**
```json
{
  "target": "acmecorp.com",
  "brand_authority": 28
}
```

**Row cost:** 1 row per target

**What it measures:**
- Brand search volume
- Brand mention frequency
- Social signals
- Direct traffic patterns

---

### 4. Ranking Keywords

**Endpoint:**
```
POST https://lsapi.seomoz.com/v2/ranking_keywords
```

**Request body:**
```json
{
  "target": "acmecorp.com",
  "limit": 200
}
```

**Response:**
```json
{
  "results": [
    {
      "keyword": "seo tools",
      "ranking_position": 5,
      "search_volume": 12000,
      "difficulty": 68,
      "estimated_monthly_traffic": 450
    },
    {
      "keyword": "keyword research",
      "ranking_position": 12,
      "search_volume": 8500,
      "difficulty": 72,
      "estimated_monthly_traffic": 180
    }
  ]
}
```

**Row cost:** 1 row per keyword returned (capped at 200)

**Parameters:**
- `limit`: Max keywords to return (portal uses 200)
- `offset`: For pagination (not used in POC)

---

## Response Mapping to Database

### Target Table: `mozMetrics`

**New table — add to `src/lib/db/schema.ts`:**

```typescript
export const mozMetrics = sqliteTable("moz_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  
  // URL Metrics
  domainAuthority: integer("domain_authority"), // 0-100
  pageAuthority: integer("page_authority"),     // 0-100
  spamScore: integer("spam_score"),             // 0-100
  
  // Brand Authority
  brandAuthority: integer("brand_authority"),   // 0-100
  
  // Link Metrics
  backlinks: integer("backlinks"),              // external_pages
  referringDomains: integer("referring_domains"), // external_root_domains
  
  // Ranking Keywords (aggregated)
  organicKeywords: integer("organic_keywords"), // count of ranking keywords
  organicTraffic: integer("organic_traffic"),   // sum of estimated_monthly_traffic
  
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueClientDate: unique().on(table.clientId, table.date),
}));

export type MozMetrics = typeof mozMetrics.$inferSelect;
export type NewMozMetrics = typeof mozMetrics.$inferInsert;
```

### Column Mapping

| Moz API Field | mozMetrics Column | Source Endpoint |
|---|---|---|
| `domain_authority` | `domainAuthority` | `url_metrics` |
| `page_authority` | `pageAuthority` | `url_metrics` |
| `spam_score` | `spamScore` | `url_metrics` |
| `brand_authority` | `brandAuthority` | `brand_authority` |
| `external_pages` | `backlinks` | `link_metrics` |
| `external_root_domains` | `referringDomains` | `link_metrics` |
| Count of `ranking_keywords` | `organicKeywords` | `ranking_keywords` |
| Sum of `estimated_monthly_traffic` | `organicTraffic` | `ranking_keywords` |

### Upsert Strategy

**Unique constraint:** `(clientId, date)`

**Drizzle ORM:**
```typescript
await db.insert(mozMetrics)
  .values({
    clientId,
    date: today,
    domainAuthority: urlMetricsData.domain_authority,
    pageAuthority: urlMetricsData.page_authority,
    spamScore: urlMetricsData.spam_score,
    brandAuthority: brandAuthorityData.brand_authority,
    backlinks: linkMetricsData.external_pages,
    referringDomains: linkMetricsData.external_root_domains,
    organicKeywords: rankingKeywords.length,
    organicTraffic: rankingKeywords.reduce((sum, kw) => sum + kw.estimated_monthly_traffic, 0),
  })
  .onConflictDoUpdate({
    target: [mozMetrics.clientId, mozMetrics.date],
    set: {
      domainAuthority: sql`excluded.domain_authority`,
      pageAuthority: sql`excluded.page_authority`,
      spamScore: sql`excluded.spam_score`,
      brandAuthority: sql`excluded.brand_authority`,
      backlinks: sql`excluded.backlinks`,
      referringDomains: sql`excluded.referring_domains`,
      organicKeywords: sql`excluded.organic_keywords`,
      organicTraffic: sql`excluded.organic_traffic`,
    },
  });
```

---

## Keyword Research Enrichment

### Goal

Update `keyword_research` table with current ranking positions from Moz `ranking_keywords` endpoint.

### Logic

For each keyword returned by `ranking_keywords`:
1. Match to existing `keyword_research` rows by `clientId + keyword` (case-insensitive)
2. Update `currentPosition` with `ranking_position`
3. Update `monthlyVolume` with `search_volume` (if not already set by DataForSEO)
4. Update `difficulty` with `difficulty` (if not already set by DataForSEO)

For keywords in `keyword_research` NOT in the Moz response:
- Set `currentPosition` to `NULL` (not ranking in top 100)

### Implementation

```typescript
// 1. Fetch all keyword_research rows for this client
const existingKeywords = await db.select()
  .from(keywordResearch)
  .where(eq(keywordResearch.clientId, clientId));

// 2. Create a map for fast lookup (case-insensitive)
const keywordMap = new Map(
  existingKeywords.map(kw => [kw.keyword.toLowerCase(), kw])
);

// 3. Update matched keywords
for (const mozKeyword of rankingKeywords) {
  const existing = keywordMap.get(mozKeyword.keyword.toLowerCase());
  
  if (existing) {
    await db.update(keywordResearch)
      .set({
        currentPosition: mozKeyword.ranking_position,
        monthlyVolume: existing.monthlyVolume || mozKeyword.search_volume,
        difficulty: existing.difficulty || mozKeyword.difficulty,
      })
      .where(eq(keywordResearch.id, existing.id));
  }
}

// 4. Set currentPosition to NULL for unmatched keywords
const rankedKeywords = new Set(rankingKeywords.map(kw => kw.keyword.toLowerCase()));

for (const existing of existingKeywords) {
  if (!rankedKeywords.has(existing.keyword.toLowerCase())) {
    await db.update(keywordResearch)
      .set({ currentPosition: null })
      .where(eq(keywordResearch.id, existing.id));
  }
}
```

---

## Dashboard KPI Change

### Old (Ahrefs)

**Label:** "Domain Rating"  
**Source:** `ahrefsMetrics.domainRating`  
**Range:** 0-100

### New (Moz)

**Label:** "Domain Authority"  
**Source:** `mozMetrics.domainAuthority`  
**Range:** 0-100

### File to Update

**`src/app/portal/[clientSlug]/dashboard/page.tsx`**

**Old query:**
```typescript
const latestAhrefs = await db.select()
  .from(ahrefsMetrics)
  .where(eq(ahrefsMetrics.clientId, client.id))
  .orderBy(desc(ahrefsMetrics.date))
  .limit(1);

const domainRating = latestAhrefs[0]?.domainRating || 0;
```

**New query:**
```typescript
const latestMoz = await db.select()
  .from(mozMetrics)
  .where(eq(mozMetrics.clientId, client.id))
  .orderBy(desc(mozMetrics.date))
  .limit(1);

const domainAuthority = latestMoz[0]?.domainAuthority || 0;
```

**KPI card:**
```tsx
<KpiCard
  title="Domain Authority"
  value={domainAuthority}
  trend={calculateTrend(currentDA, previousDA)}
  icon={<TrendingUpIcon />}
/>
```

### Client Communication

> 📝 **NOTE:** Domain Authority (DA) and Domain Rating (DR) are conceptually identical — both measure a domain's ranking strength on a 0-100 scale. Clients familiar with DR will understand DA immediately.

**Email template for client notification:**
```
Subject: SEO Portal Update: Domain Authority Metric

Hi [Client Name],

We've upgraded your SEO portal to use Moz's Domain Authority (DA) metric instead of Ahrefs' Domain Rating (DR).

What's changing:
- Metric name: "Domain Rating" → "Domain Authority"
- Same 0-100 scale
- Same concept: measures your domain's ranking strength

Why we're making this change:
- Domain Authority is more widely recognized in the industry
- Provides additional insights like Brand Authority and Spam Score
- More cost-effective for our agency (savings passed to you)

Your current Domain Authority: [XX]/100

No action needed on your end. Your portal will continue to update weekly.

Questions? Reply to this email.

Best,
BIT Brand Anarchy Team
```

---

## Error Handling

### Common Error Codes

| Code | Meaning | Portal Error Message |
|---|---|---|
| `401` | Invalid credentials | `Invalid Moz API credentials - verify Access ID and Secret Key` |
| `403` | Insufficient permissions | `Moz API access denied - verify plan includes API access` |
| `429` | Rate limit exceeded | `Moz API rate limit exceeded - try again later` |
| `500` | Moz server error | `Moz API error - try again later` |

### Row Limit Exceeded

**Detection:**
```typescript
if (monthlyRowsUsed >= 15000) {
  return {
    success: false,
    rowsInserted: 0,
    error: "Moz monthly row limit exceeded (15,000 rows) - sync skipped",
    source: "MOZ",
  };
}
```

**Admin notification:**
- Log warning to console
- Update `dataSources.lastSyncError` with quota message
- TODO: Send email to admin

---

## Testing

### Manual Sync via API

```bash
# Trigger sync for a specific client
curl -X POST http://localhost:3000/api/sync/{clientId}/MOZ

# Expected response (success)
{
  "success": true,
  "rowsInserted": 203,
  "source": "MOZ"
}

# Expected response (failure - invalid credentials)
{
  "success": false,
  "rowsInserted": 0,
  "error": "Invalid Moz API credentials - verify Access ID and Secret Key",
  "source": "MOZ"
}
```

### Manual Sync via Admin UI

1. Log in as admin
2. Navigate to `/admin/clients/[id]`
3. Scroll to **Sync Controls** section
4. Click **Sync Now** next to Moz
5. Check sync status panel for success/error

### Verify Data in Database

```bash
sqlite3 ./data/portal.db

# Check row count
SELECT COUNT(*) FROM moz_metrics WHERE clientId = '{clientId}';
-- Expected: 1 per sync (daily snapshots)

# Check latest data
SELECT date, domainAuthority, backlinks, referringDomains, organicKeywords
FROM moz_metrics
WHERE clientId = '{clientId}'
ORDER BY date DESC
LIMIT 7;

# Check keyword enrichment
SELECT keyword, currentPosition, monthlyVolume, difficulty
FROM keyword_research
WHERE clientId = '{clientId}' AND currentPosition IS NOT NULL
ORDER BY currentPosition ASC
LIMIT 10;
```

### Verify Dashboard KPI

1. Navigate to `/portal/[clientSlug]/dashboard`
2. Verify **Domain Authority** KPI card displays correct value
3. Verify trend indicator (up/down arrow) based on previous sync

---

## Implementation Checklist

- [ ] Sign up for Moz Growth Medium plan ($75/mo) at https://moz.com/products/api
- [ ] Obtain Access ID and Secret Key from Moz account
- [ ] Add `mozMetrics` table to `src/lib/db/schema.ts`
- [ ] Run `bun run db:generate` to create migration
- [ ] Run `bun run db:migrate` to apply migration
- [ ] Store credentials in portal: `/admin/settings/api-credentials` → MOZ
- [ ] Configure domain for each client: `/admin/clients/[id]` → Data Sources → MOZ
- [ ] Create `src/lib/integrations/moz.ts` with `syncMozData()` function
- [ ] Implement all 4 endpoint calls: `url_metrics`, `link_metrics`, `brand_authority`, `ranking_keywords`
- [ ] Implement keyword enrichment logic
- [ ] Implement row quota tracking and warning
- [ ] Update dashboard query to use `mozMetrics` instead of `ahrefsMetrics`
- [ ] Update KPI card label from "Domain Rating" to "Domain Authority"
- [ ] Test sync via API: `POST /api/sync/{clientId}/MOZ`
- [ ] Verify data in `moz_metrics` table
- [ ] Verify keyword enrichment in `keyword_research` table
- [ ] Verify dashboard displays Domain Authority correctly
- [ ] Send client notification email about metric change

---

## File Location

**Implementation:** `src/lib/integrations/moz.ts` (new file)

**Function signature:**
```typescript
export async function syncMozData(clientId: string): Promise<SyncResult>
```

**Dependencies:**
- `src/lib/db` (Drizzle ORM)
- `src/lib/db/schema` (`apiCredentials`, `dataSources`, `mozMetrics`, `keywordResearch`)
- `src/lib/integrations/types` (`SyncResult`)

---

## References

- [Moz API Documentation](https://moz.com/help/links-api)
- [Moz Pricing](https://moz.com/products/api/pricing)
- [Domain Authority Explained](https://moz.com/learn/seo/domain-authority)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
