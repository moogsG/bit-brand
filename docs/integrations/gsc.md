# Google Search Console Integration

**Provider:** Google Search Console (GSC)  
**Auth Method:** Service Account (Agency-level, reuses GA4 service account)  
**Implementation:** `src/lib/integrations/gsc.ts`

---

## What It Provides

### Metrics

- Clicks (per query, per page)
- Impressions (per query, per page)
- CTR (Click-Through Rate)
- Average Position (in search results)

### Powers These Features

| Feature | Location | Metric Used |
|---|---|---|
| Total Clicks KPI card | `/portal/[clientSlug]/dashboard` | Sum of `clicks` |
| Average Position KPI card | `/portal/[clientSlug]/dashboard` | Weighted avg of `position` |
| Search Performance chart | `/portal/[clientSlug]/dashboard` | `clicks`, `impressions`, `ctr` over time |
| Top Keywords table | `/portal/[clientSlug]/dashboard` | Top 10 queries by `clicks` |
| Keyword Rankings section | Monthly reports | All queries with positions |

---

## Authentication Approach

### Reuse GA4 Service Account

**Why:**
- Same Google Cloud service account used for GA4
- No additional credentials needed
- Simpler credential management

**How It Works:**
1. Use the same service account created for GA4 integration
2. Share service account email with each client's Search Console property
3. Credentials stored once in `apiCredentials` table (can be same record as GA4 or separate)
4. Per-client config only requires exact site URL

### Credentials Storage

**Agency-level (`apiCredentials` table):**
```json
{
  "serviceAccountEmail": "bba-analytics@your-project.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
}
```

> 📝 **NOTE:** Can use the same `apiCredentials` record as GA4 (provider=GSC) or create a separate record with identical credentials.

**Per-client (`dataSources` table):**
- `type`: `"GSC"`
- `propertyIdentifier`: Exact site URL as registered in Search Console
- `isConnected`: `true` when configured
- `lastSyncedAt`: timestamp of last successful sync
- `lastSyncError`: error message if sync failed

### Required npm Package

```bash
bun add google-auth-library
```

(Same package as GA4 — no additional install needed if GA4 is already implemented.)

### OAuth Scope

```
https://www.googleapis.com/auth/webmasters.readonly
```

---

## Service Account Setup (Step-by-Step)

### 1. Reuse GA4 Service Account

If you've already created a service account for GA4, skip to step 2.

If not, follow the GA4 integration guide to create a service account first.

### 2. Share Service Account with Client Search Console Properties

**For each client:**

1. Open [Google Search Console](https://search.google.com/search-console)
2. Select the client's property from the dropdown (top left)
3. Click **Settings** (left sidebar, bottom)
4. Click **Users and permissions**
5. Click **Add user** (top right)
6. Paste the service account email: `bba-analytics@your-project.iam.gserviceaccount.com`
7. Select permission level: **Full** or **Restricted** (Restricted is sufficient for read-only)
8. Click **Add**

> ✅ **ACTION REQUIRED:** Repeat step 2 for every client property. Without this, sync will fail with 403 error.

### 3. Store Credentials in Portal

If using the same credentials as GA4:
1. Log in as admin → `/admin/settings/api-credentials`
2. Select provider: **GSC**
3. Paste the same service account email and private key used for GA4
4. Click **Save**

If credentials are already stored for GA4, the integration can read from the GA4 record (implementation decision).

### 4. Configure Per-Client Site URL

1. Navigate to `/admin/clients/[id]`
2. Data Sources section → **GSC**
3. Enter **Site URL** (see format requirements below)
4. Toggle **Connected** → **Save**

---

## Site URL Format (CRITICAL)

> ⚠️ **WARNING:** Search Console treats these as SEPARATE properties:

| Format | Example |
|---|---|
| HTTP without www | `http://example.com` |
| HTTPS without www | `https://example.com` |
| HTTPS with www | `https://www.example.com` |
| HTTPS with www + trailing slash | `https://www.example.com/` |
| Domain property | `sc-domain:example.com` |

### How to Find the Correct URL

1. Open Search Console
2. Click the property dropdown (top left)
3. Copy the EXACT URL shown in the dropdown
4. Paste into the portal's Site URL field

### Admin UI Helper Text

The data source form should display:
```
Enter the exact site URL as shown in Search Console, including protocol (http:// or https://) and trailing slash if present.

Examples:
- https://www.example.com/
- https://example.com
- sc-domain:example.com
```

### URL Encoding in API Requests

The site URL must be URL-encoded when used in the API path:

| Original | Encoded |
|---|---|
| `https://www.example.com/` | `https%3A%2F%2Fwww.example.com%2F` |
| `sc-domain:example.com` | `sc-domain%3Aexample.com` |

**JavaScript:**
```typescript
const encodedSiteUrl = encodeURIComponent(siteUrl);
```

---

## API Details

### Endpoint

```
POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
```

**Note:** `{siteUrl}` must be URL-encoded.

### Authentication

Same as GA4 — service account credentials are exchanged for a short-lived access token:

```typescript
import { JWT } from 'google-auth-library';

const client = new JWT({
  email: serviceAccountEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
});

const accessToken = await client.getAccessToken();
```

Access token is passed in the `Authorization` header:
```
Authorization: Bearer ya29.c.Kl6...
```

### Request Body

```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-04-01",
  "dimensions": ["date", "query", "page"],
  "rowLimit": 25000,
  "dataState": "final"
}
```

### Parameters Explained

| Parameter | Value | Why |
|---|---|---|
| `startDate` | 90 days ago (YYYY-MM-DD) | Match GA4 date range |
| `endDate` | Yesterday (YYYY-MM-DD) | Exclude today's incomplete data |
| `dimensions` | `["date", "query", "page"]` | Daily breakdown per query per page |
| `rowLimit` | `25000` | Max rows per request (API limit) |
| `dataState` | `"final"` | Exclude data still being processed (first 3 days) |

### Date Range Calculation

```typescript
const endDate = new Date();
endDate.setDate(endDate.getDate() - 1); // Yesterday

const startDate = new Date();
startDate.setDate(startDate.getDate() - 90); // 90 days ago

const startDateStr = startDate.toISOString().split('T')[0]; // "2025-01-01"
const endDateStr = endDate.toISOString().split('T')[0];     // "2025-04-01"
```

### Response Format

```json
{
  "rows": [
    {
      "keys": ["2025-01-15", "seo tools", "https://example.com/tools"],
      "clicks": 42,
      "impressions": 1234,
      "ctr": 0.034,
      "position": 5.6
    },
    {
      "keys": ["2025-01-15", "keyword research", "https://example.com/blog/keywords"],
      "clicks": 18,
      "impressions": 567,
      "ctr": 0.032,
      "position": 8.2
    }
  ]
}
```

---

## Response Mapping to Database

### Target Table: `gsc_metrics`

| GSC Field | Column | Type | Notes |
|---|---|---|---|
| `keys[0]` (date) | `date` | TEXT | Already in YYYY-MM-DD format |
| `keys[1]` (query) | `query` | TEXT | Search query string |
| `keys[2]` (page) | `page` | TEXT | Full URL of ranking page |
| `clicks` | `clicks` | INTEGER | Number of clicks |
| `impressions` | `impressions` | INTEGER | Number of impressions |
| `ctr` | `ctr` | REAL | Click-through rate (0.0-1.0) |
| `position` | `position` | REAL | Average position in search results |

### Date Format

> ✅ **No conversion needed.** GSC returns dates in `YYYY-MM-DD` format (unlike GA4).

---

## Deduplication Strategy

### Delete-Then-Insert Approach

**Why not upsert:**
- Unique constraint would require 4 columns: `(clientId, date, query, page)`
- GSC data becomes "final" after 3 days — re-syncing yields identical data
- Simpler to delete existing rows for the date range, then insert fresh data

**Implementation:**
```typescript
// 1. Delete existing rows for this client in the sync date range
await db.delete(gscMetrics)
  .where(
    and(
      eq(gscMetrics.clientId, clientId),
      gte(gscMetrics.date, startDateStr)
    )
  );

// 2. Insert new rows
await db.insert(gscMetrics).values(rows);
```

**Rationale:**
- Handles removed queries (pages that stopped ranking)
- Handles updated metrics (CTR/position changes)
- Simpler than 4-column unique constraint + conflict resolution

---

## Rate Limits

### Google Search Console API Quotas

| Quota | Limit | Portal Usage |
|---|---|---|
| Requests per day | 1,200 | ~40/month |
| Requests per 100 seconds | 600 | 1 per sync |

### Portal Usage Calculation

- 10 clients
- 1 request per sync per client
- 4 syncs per month (weekly)
- **Total:** 10 × 1 × 4 = **40 requests/month**

> ✅ **Well within limits.** No rate limiting logic needed for POC.

---

## Pagination

### Row Limit: 25,000

The API returns a maximum of 25,000 rows per request.

**When pagination is needed:**
- Client has >25,000 unique `(date, query, page)` combinations in 90 days
- Typical scenario: large e-commerce site with thousands of pages

**How to paginate:**
Use the `startRow` parameter:

```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-04-01",
  "dimensions": ["date", "query", "page"],
  "rowLimit": 25000,
  "startRow": 25000,
  "dataState": "final"
}
```

**Implementation strategy for POC:**
1. Start without pagination
2. Monitor row counts in `gscMetrics` table
3. If any client approaches 25,000 rows, implement pagination

**Pagination loop:**
```typescript
let startRow = 0;
let hasMore = true;

while (hasMore) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ ...requestBody, startRow }),
  });
  
  const data = await response.json();
  
  if (!data.rows || data.rows.length === 0) {
    hasMore = false;
  } else {
    // Insert rows
    await db.insert(gscMetrics).values(data.rows.map(...));
    
    if (data.rows.length < 25000) {
      hasMore = false;
    } else {
      startRow += 25000;
    }
  }
}
```

---

## Error Handling

### Common Error Codes

| Code | Meaning | Portal Error Message |
|---|---|---|
| `403` | Service account not added to property | `Access denied - verify service account is added to Search Console property` |
| `404` | Site URL not found | `Site URL not found in Search Console - verify exact URL format including protocol and trailing slash` |
| `400` | Invalid date range or parameters | `Invalid request parameters - check date range and site URL` |
| `429` | Rate limit exceeded (unlikely) | `GSC API rate limit exceeded - try again later` |
| `500` | GSC server error | `GSC API error - try again later` |

### Error Storage

On sync failure:
- `dataSources.lastSyncError` is updated with the error message
- `dataSources.lastSyncedAt` is NOT updated (remains at last successful sync)
- `SyncResult.success = false`, `SyncResult.error = "..."` is returned

### Retry Logic

No automatic retry. Admin must manually trigger re-sync via:
- Admin UI: Client detail page → Sync Controls → "Sync Now"
- API: `POST /api/sync/{clientId}/GSC`

---

## Testing

### Manual Sync via API

```bash
# Trigger sync for a specific client
curl -X POST http://localhost:3000/api/sync/{clientId}/GSC

# Expected response (success)
{
  "success": true,
  "rowsInserted": 1234,
  "source": "GSC"
}

# Expected response (failure - 404)
{
  "success": false,
  "rowsInserted": 0,
  "error": "Site URL not found in Search Console - verify exact URL format including protocol and trailing slash",
  "source": "GSC"
}
```

### Manual Sync via Admin UI

1. Log in as admin
2. Navigate to `/admin/clients/[id]`
3. Scroll to **Sync Controls** section
4. Click **Sync Now** next to GSC
5. Check sync status panel for success/error

### Verify Data in Database

```bash
sqlite3 ./data/portal.db

# Check row count
SELECT COUNT(*) FROM gsc_metrics WHERE clientId = '{clientId}';
-- Expected: varies (depends on number of queries/pages)

# Check recent data
SELECT date, query, clicks, impressions, position 
FROM gsc_metrics 
WHERE clientId = '{clientId}' 
ORDER BY date DESC, clicks DESC 
LIMIT 10;

# Check for duplicate rows (should be 0 after delete-then-insert)
SELECT date, query, page, COUNT(*) as count
FROM gsc_metrics
WHERE clientId = '{clientId}'
GROUP BY date, query, page
HAVING count > 1;
-- Expected: 0 rows

# Check date format
SELECT date FROM gsc_metrics WHERE date NOT LIKE '____-__-__';
-- Expected: 0 rows (all dates should be YYYY-MM-DD)
```

### Verify Top Keywords on Dashboard

1. Navigate to `/portal/[clientSlug]/dashboard`
2. Scroll to **Top Keywords** table
3. Verify queries are sorted by clicks (descending)
4. Verify positions are displayed correctly

---

## Implementation Checklist

- [ ] Reuse GA4 service account (or create new one)
- [ ] Share service account email with all client Search Console properties
- [ ] Store credentials in portal: `/admin/settings/api-credentials` → GSC
- [ ] Configure site URLs for each client: `/admin/clients/[id]` → Data Sources → GSC
- [ ] Add helper text to Site URL field explaining format requirements
- [ ] Implement `syncGSCData()` in `src/lib/integrations/gsc.ts`
- [ ] Implement delete-then-insert deduplication strategy
- [ ] Test sync via API: `POST /api/sync/{clientId}/GSC`
- [ ] Verify data in `gsc_metrics` table
- [ ] Update dashboard to query `gsc_metrics` for Total Clicks, Average Position, Top Keywords
- [ ] Monitor row counts — implement pagination if any client exceeds 20,000 rows

---

## File Location

**Implementation:** `src/lib/integrations/gsc.ts`

**Function signature:**
```typescript
export async function syncGSCData(clientId: string): Promise<SyncResult>
```

**Dependencies:**
- `google-auth-library` (JWT authentication)
- `src/lib/db` (Drizzle ORM)
- `src/lib/db/schema` (`apiCredentials`, `dataSources`, `gscMetrics`)
- `src/lib/integrations/types` (`SyncResult`)

---

## References

- [Google Search Console API Documentation](https://developers.google.com/webmaster-tools/search-console-api-original)
- [Search Analytics Query API](https://developers.google.com/webmaster-tools/search-console-api-original/v3/searchanalytics/query)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)
- [google-auth-library npm package](https://www.npmjs.com/package/google-auth-library)
