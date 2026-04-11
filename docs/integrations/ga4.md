# Google Analytics 4 Integration

**Provider:** Google Analytics 4 (GA4)  
**Auth Method:** Service Account (Agency-level)  
**Implementation:** `src/lib/integrations/ga4.ts`

---

## What It Provides

### Metrics

- Sessions
- Users (total)
- New Users
- Pageviews
- Bounce Rate
- Average Session Duration
- Organic Sessions (from Google Search)

### Powers These Features

| Feature | Location | Metric Used |
|---|---|---|
| Organic Sessions KPI card | `/portal/[clientSlug]/dashboard` | `organicSessions` |
| Traffic Trend chart | `/portal/[clientSlug]/dashboard` | `sessions`, `organicSessions` |
| Traffic Overview section | Monthly reports | All metrics |

---

## Authentication Approach

### Agency Service Account (NOT Per-Client OAuth)

**Why Service Account:**
- One set of credentials for all clients
- No OAuth consent flow per client
- No token expiration/refresh logic
- Simpler admin workflow

**How It Works:**
1. Agency creates ONE Google Cloud service account
2. Service account email is shared with each client's GA4 property as Viewer
3. Credentials stored once in `apiCredentials` table
4. Per-client config only requires GA4 property ID

### Credentials Storage

**Agency-level (`apiCredentials` table):**
```json
{
  "serviceAccountEmail": "bba-analytics@your-project.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
}
```

**Per-client (`dataSources` table):**
- `type`: `"GA4"`
- `propertyIdentifier`: GA4 property ID (format: `properties/123456789`)
- `isConnected`: `true` when configured
- `lastSyncedAt`: timestamp of last successful sync
- `lastSyncError`: error message if sync failed

### Required npm Package

```bash
bun add google-auth-library
```

### OAuth Scope

```
https://www.googleapis.com/auth/analytics.readonly
```

---

## Service Account Setup (Step-by-Step)

### 1. Create Service Account in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Name: `bba-analytics` (or similar)
6. Description: `BIT Brand Anarchy SEO Portal - GA4 Read Access`
7. Click **Create and Continue**
8. Skip role assignment (not needed at project level)
9. Click **Done**

### 2. Generate JSON Key File

1. Click on the newly created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create**
6. Save the downloaded JSON file securely

The JSON file contains:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "bba-analytics@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### 3. Share Service Account with Client GA4 Properties

**For each client:**

1. Open the client's GA4 property
2. Go to **Admin** (bottom left gear icon)
3. Under **Property**, click **Property Access Management**
4. Click **Add users** (+ icon, top right)
5. Paste the service account email: `bba-analytics@your-project.iam.gserviceaccount.com`
6. Assign role: **Viewer** (read-only access)
7. Uncheck "Notify new users by email" (service accounts don't receive email)
8. Click **Add**

> ✅ **ACTION REQUIRED:** Repeat step 3 for every client property. Without this, sync will fail with 403 error.

### 4. Store Credentials in Portal

1. Log in as admin → `/admin/settings/api-credentials`
2. Select provider: **GA4**
3. Paste the service account email from the JSON file
4. Paste the private key (entire block including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
5. Click **Save**

Credentials are stored in `apiCredentials` table with `provider = "GA4"`.

### 5. Configure Per-Client Property ID

1. Navigate to `/admin/clients/[id]`
2. Data Sources section → **GA4**
3. Enter **Property ID** (format: `properties/123456789`)
   - Find this in GA4: Admin → Property Settings → Property ID
4. Toggle **Connected** → **Save**

---

## API Details

### Endpoint

```
POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
```

### Authentication

Service account credentials are exchanged for a short-lived access token using `google-auth-library`:

```typescript
import { JWT } from 'google-auth-library';

const client = new JWT({
  email: serviceAccountEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
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
  "dateRanges": [
    {
      "startDate": "90daysAgo",
      "endDate": "yesterday"
    }
  ],
  "dimensions": [
    { "name": "date" }
  ],
  "metrics": [
    { "name": "sessions" },
    { "name": "totalUsers" },
    { "name": "newUsers" },
    { "name": "screenPageViews" },
    { "name": "bounceRate" },
    { "name": "averageSessionDuration" },
    { "name": "organicGoogleSearchSessions" }
  ]
}
```

### Date Range

- **Start:** `90daysAgo` (relative to today)
- **End:** `yesterday` (excludes today's incomplete data)
- **Result:** 90 days of finalized daily metrics

### Response Format

```json
{
  "dimensionHeaders": [
    { "name": "date" }
  ],
  "metricHeaders": [
    { "name": "sessions", "type": "TYPE_INTEGER" },
    { "name": "totalUsers", "type": "TYPE_INTEGER" },
    { "name": "newUsers", "type": "TYPE_INTEGER" },
    { "name": "screenPageViews", "type": "TYPE_INTEGER" },
    { "name": "bounceRate", "type": "TYPE_FLOAT" },
    { "name": "averageSessionDuration", "type": "TYPE_SECONDS" },
    { "name": "organicGoogleSearchSessions", "type": "TYPE_INTEGER" }
  ],
  "rows": [
    {
      "dimensionValues": [
        { "value": "20250101" }
      ],
      "metricValues": [
        { "value": "1234" },
        { "value": "987" },
        { "value": "456" },
        { "value": "5678" },
        { "value": "0.42" },
        { "value": "123.45" },
        { "value": "789" }
      ]
    }
  ]
}
```

---

## Response Mapping to Database

### Target Table: `ga4_metrics`

| GA4 Metric | Column | Type | Notes |
|---|---|---|---|
| `date` dimension | `date` | TEXT | **Convert YYYYMMDD → YYYY-MM-DD** |
| `sessions` | `sessions` | INTEGER | Total sessions |
| `totalUsers` | `users` | INTEGER | Total users |
| `newUsers` | `newUsers` | INTEGER | First-time users |
| `screenPageViews` | `pageviews` | INTEGER | Total pageviews |
| `bounceRate` | `bounceRate` | REAL | Decimal 0.0-1.0 |
| `averageSessionDuration` | `avgSessionDuration` | REAL | Seconds |
| `organicGoogleSearchSessions` | `organicSessions` | INTEGER | Sessions from Google Search |

### Date Format Conversion (CRITICAL)

> ⚠️ **WARNING:** GA4 returns dates as `YYYYMMDD` (e.g. `20250101`). The database expects `YYYY-MM-DD` (e.g. `2025-01-01`).

**Conversion logic:**
```typescript
function formatGA4Date(yyyymmdd: string): string {
  // "20250101" → "2025-01-01"
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
```

### Upsert Strategy

**Unique constraint:** `(clientId, date)`

**Drizzle ORM:**
```typescript
await db.insert(ga4Metrics)
  .values(rows)
  .onConflictDoUpdate({
    target: [ga4Metrics.clientId, ga4Metrics.date],
    set: {
      sessions: sql`excluded.sessions`,
      users: sql`excluded.users`,
      newUsers: sql`excluded.new_users`,
      pageviews: sql`excluded.pageviews`,
      bounceRate: sql`excluded.bounce_rate`,
      avgSessionDuration: sql`excluded.avg_session_duration`,
      organicSessions: sql`excluded.organic_sessions`,
    },
  });
```

**Rationale:** Re-syncing the same date range updates metrics if GA4 data was revised.

---

## Rate Limits

### Google Analytics Data API Quotas

| Quota | Limit | Portal Usage |
|---|---|---|
| Requests per day per project | 25,000 | ~40/month |
| Requests per 100 seconds | 300 | 1 per sync |
| Concurrent requests | 10 | 1 per sync |

### Portal Usage Calculation

- 10 clients
- 1 request per sync per client
- 4 syncs per month (weekly)
- **Total:** 10 × 1 × 4 = **40 requests/month**

> ✅ **Well within limits.** No rate limiting logic needed for POC.

---

## Error Handling

### Common Error Codes

| Code | Meaning | Portal Error Message |
|---|---|---|
| `403` | Service account not shared with property | `Access denied - verify service account has Viewer access to GA4 property {propertyId}` |
| `400` | Invalid property ID format | `Invalid GA4 property ID - format must be properties/XXXXXXXXX` |
| `404` | Property not found | `GA4 property not found - verify property ID` |
| `429` | Quota exceeded (unlikely) | `GA4 API quota exceeded - try again later` |
| `500` | GA4 server error | `GA4 API error - try again later` |

### Error Storage

On sync failure:
- `dataSources.lastSyncError` is updated with the error message
- `dataSources.lastSyncedAt` is NOT updated (remains at last successful sync)
- `SyncResult.success = false`, `SyncResult.error = "..."` is returned

### Retry Logic

No automatic retry. Admin must manually trigger re-sync via:
- Admin UI: Client detail page → Sync Controls → "Sync Now"
- API: `POST /api/sync/{clientId}/GA4`

---

## Testing

### Manual Sync via API

```bash
# Trigger sync for a specific client
curl -X POST http://localhost:3000/api/sync/{clientId}/GA4

# Expected response (success)
{
  "success": true,
  "rowsInserted": 90,
  "source": "GA4"
}

# Expected response (failure)
{
  "success": false,
  "rowsInserted": 0,
  "error": "Access denied - verify service account has Viewer access to GA4 property properties/123456789",
  "source": "GA4"
}
```

### Manual Sync via Admin UI

1. Log in as admin
2. Navigate to `/admin/clients/[id]`
3. Scroll to **Sync Controls** section
4. Click **Sync Now** next to GA4
5. Check sync status panel for success/error

### Verify Data in Database

```bash
sqlite3 ./data/portal.db

# Check row count
SELECT COUNT(*) FROM ga4_metrics WHERE clientId = '{clientId}';
-- Expected: 90 (last 90 days)

# Check recent data
SELECT date, sessions, organicSessions FROM ga4_metrics 
WHERE clientId = '{clientId}' 
ORDER BY date DESC 
LIMIT 7;

# Check for date format errors
SELECT date FROM ga4_metrics WHERE date NOT LIKE '____-__-__';
-- Expected: 0 rows (all dates should be YYYY-MM-DD)
```

---

## Implementation Checklist

- [ ] Install `google-auth-library`: `bun add google-auth-library`
- [ ] Create Google Cloud service account
- [ ] Download JSON key file
- [ ] Share service account email with all client GA4 properties (Viewer role)
- [ ] Store credentials in portal: `/admin/settings/api-credentials` → GA4
- [ ] Configure property IDs for each client: `/admin/clients/[id]` → Data Sources → GA4
- [ ] Implement `syncGA4Data()` in `src/lib/integrations/ga4.ts`
- [ ] Test sync via API: `POST /api/sync/{clientId}/GA4`
- [ ] Verify data in `ga4_metrics` table
- [ ] Update dashboard to query `ga4_metrics` for Organic Sessions KPI and Traffic chart

---

## File Location

**Implementation:** `src/lib/integrations/ga4.ts`

**Function signature:**
```typescript
export async function syncGA4Data(clientId: string): Promise<SyncResult>
```

**Dependencies:**
- `google-auth-library` (JWT authentication)
- `src/lib/db` (Drizzle ORM)
- `src/lib/db/schema` (`apiCredentials`, `dataSources`, `ga4Metrics`)
- `src/lib/integrations/types` (`SyncResult`)

---

## References

- [Google Analytics Data API v1 Documentation](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)
- [google-auth-library npm package](https://www.npmjs.com/package/google-auth-library)
