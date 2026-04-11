# Weekly Sync Scheduler

## Overview

The weekly sync scheduler automates data refreshes for all active clients without manual intervention. This ensures client dashboards always display current data and reduces admin workload.

**Scale:**
- 10 clients × 5 sources = 50 sync operations per week
- Manual syncs via admin UI remain available for on-demand refreshes

## Recommended Approach: Vercel Cron Jobs

**Why Vercel Cron:**
- Native to Next.js/Vercel deployment
- Zero additional infrastructure (no external cron services)
- Configured in `vercel.json` at project root
- Calls a Next.js API route on schedule
- Free on Vercel Pro plan (up to 100 cron jobs)

**Alternative approaches:**
- External cron service (e.g. cron-job.org) — requires webhook endpoint
- GitHub Actions scheduled workflow — requires repository access
- AWS EventBridge — requires AWS infrastructure

**Chosen:** Vercel Cron for simplicity and zero infrastructure overhead.

## Vercel Cron Configuration

**File:** `vercel.json` (create at project root)

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

**Schedule format:** Standard cron syntax

| Field | Value | Meaning |
|---|---|---|
| Minute | `0` | At minute 0 |
| Hour | `2` | At 2:00 AM |
| Day of month | `*` | Every day |
| Month | `*` | Every month |
| Day of week | `1` | Monday |

**Result:** Runs every Monday at 2:00 AM UTC

**Why Monday 2:00 AM UTC:**
- Low traffic time for most US-based clients
- Allows weekend data to settle
- Completes before business hours (6 AM PST / 9 AM EST)

## New API Route: `/api/cron/weekly-sync`

**File:** `src/app/api/cron/weekly-sync/route.ts`

**Purpose:** Orchestrate weekly sync for all active clients

**Implementation:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, dataSources, syncJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { syncGA4Data } from "@/lib/integrations/ga4";
import { syncGSCData } from "@/lib/integrations/gsc";
import { syncMozData } from "@/lib/integrations/moz";
import { syncDataForSeoData } from "@/lib/integrations/dataforseo";
import { syncRankscaleData } from "@/lib/integrations/rankscale";

export async function POST(request: NextRequest) {
  // 1. Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Get all active clients
  const activeClients = await db.select()
    .from(clients)
    .where(eq(clients.isActive, true));

  let totalSyncs = 0;
  let successfulSyncs = 0;
  let failedSyncs = 0;

  // 3. Sync each client (limit parallelism to 3)
  const results = [];
  for (let i = 0; i < activeClients.length; i += 3) {
    const batch = activeClients.slice(i, i + 3);
    const batchResults = await Promise.allSettled(
      batch.map(client => syncAllSourcesForClient(client.id))
    );
    results.push(...batchResults);
  }

  // 4. Aggregate results
  for (const result of results) {
    if (result.status === "fulfilled") {
      totalSyncs += result.value.totalSyncs;
      successfulSyncs += result.value.successfulSyncs;
      failedSyncs += result.value.failedSyncs;
    }
  }

  return NextResponse.json({
    success: true,
    totalClients: activeClients.length,
    totalSyncs,
    successfulSyncs,
    failedSyncs,
    timestamp: new Date().toISOString(),
  });
}

async function syncAllSourcesForClient(clientId: string) {
  // Get connected sources for this client
  const sources = await db.select()
    .from(dataSources)
    .where(and(
      eq(dataSources.clientId, clientId),
      eq(dataSources.isConnected, true)
    ));

  const syncFunctions = {
    GA4: syncGA4Data,
    GSC: syncGSCData,
    MOZ: syncMozData,
    DATAFORSEO: syncDataForSeoData,
    RANKSCALE: syncRankscaleData,
  };

  let totalSyncs = 0;
  let successfulSyncs = 0;
  let failedSyncs = 0;

  // Run all syncs in parallel for this client
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      totalSyncs++;

      // Create sync job record
      const jobId = crypto.randomUUID();
      await db.insert(syncJobs).values({
        id: jobId,
        clientId,
        source: source.type,
        status: "RUNNING",
        startedAt: new Date(),
        triggeredBy: "SCHEDULER",
      });

      try {
        const syncFn = syncFunctions[source.type];
        const result = await syncFn(clientId);

        // Update sync job on success
        await db.update(syncJobs)
          .set({
            status: "SUCCESS",
            completedAt: new Date(),
            rowsInserted: result.rowsInserted,
          })
          .where(eq(syncJobs.id, jobId));

        // Update data source
        await db.update(dataSources)
          .set({
            lastSyncedAt: new Date(),
            lastSyncError: null,
          })
          .where(eq(dataSources.id, source.id));

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Update sync job on failure
        await db.update(syncJobs)
          .set({
            status: "FAILED",
            completedAt: new Date(),
            error: errorMessage,
          })
          .where(eq(syncJobs.id, jobId));

        // Update data source
        await db.update(dataSources)
          .set({
            lastSyncError: errorMessage,
          })
          .where(eq(dataSources.id, source.id));

        return { success: false };
      }
    })
  );

  // Count successes and failures
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      successfulSyncs++;
    } else {
      failedSyncs++;
    }
  }

  return { totalSyncs, successfulSyncs, failedSyncs };
}
```

## Security: CRON_SECRET

Vercel Cron requests include an `Authorization` header with a secret token. Verify this in the route handler to prevent unauthorized access.

**Environment variable:**
```bash
CRON_SECRET=<random string>
```

**Generate secret:**
```bash
openssl rand -base64 32
```

**Verification in route:**
```typescript
const authHeader = request.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Add to `.env.local` and Vercel environment variables.**

## Sync Orchestration Logic

### 1. Verify CRON_SECRET

Reject requests without valid `Authorization: Bearer {CRON_SECRET}` header.

### 2. Query Active Clients

```typescript
const activeClients = await db.select()
  .from(clients)
  .where(eq(clients.isActive, true));
```

Only sync clients where `isActive = true`. Inactive clients are skipped.

### 3. Sync Each Client

For each client, run all connected sources using `Promise.allSettled`:
- Each source sync is independent
- One failure does not block others
- All syncs run in parallel per client

### 4. Insert `syncJobs` Rows

For each sync:
1. Insert row with `status = PENDING`
2. Update to `status = RUNNING` when sync starts
3. Update to `status = SUCCESS` or `FAILED` when sync completes
4. Record `rowsInserted` and `error` (if any)

### 5. Return Summary

```json
{
  "success": true,
  "totalClients": 10,
  "totalSyncs": 50,
  "successfulSyncs": 48,
  "failedSyncs": 2,
  "timestamp": "2025-04-14T02:00:00.000Z"
}
```

## Parallelization Strategy

**Parallel across clients, sequential within client sources:**

```typescript
// Limit to 3 clients in parallel to respect API rate limits
for (let i = 0; i < activeClients.length; i += 3) {
  const batch = activeClients.slice(i, i + 3);
  const batchResults = await Promise.allSettled(
    batch.map(client => syncAllSourcesForClient(client.id))
  );
  results.push(...batchResults);
}
```

**Why limit to 3 clients in parallel:**
- Respects API rate limits (e.g. Moz: 10 requests/second)
- Prevents overwhelming the database with concurrent writes
- Balances speed vs resource usage

**Within each client:**
All 5 sources run in parallel — no dependencies between sources.

## Sync Order — No Strict Dependencies

All 5 sources (GA4, GSC, MOZ, DATAFORSEO, RANKSCALE) can run in parallel per client. No source depends on another completing first.

**Exception:** DataForSEO enrichment depends on keywords existing in `keyword_research` table, but this is a one-time setup (admin adds keywords manually before first sync).

## Retry Strategy

Failed syncs are tracked in `syncJobs` table with `retryCount` and `status`.

**Retry schedule:**
1. **First failure:** Retry after 1 hour
2. **Second failure:** Retry after 4 hours
3. **Third failure:** Retry after 16 hours
4. **After 3 retries:** Set `status = FAILED_PERMANENT`, stop retrying

**Retry logic runs as part of the weekly cron:**
Before running new syncs, check for recent failures and retry if within retry window.

**Implementation:**
```typescript
// Check for failed syncs in the last 24 hours
const recentFailures = await db.select()
  .from(syncJobs)
  .where(and(
    eq(syncJobs.status, "FAILED"),
    gte(syncJobs.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    lt(syncJobs.retryCount, 3)
  ));

// Retry each failed sync
for (const job of recentFailures) {
  const timeSinceFailure = Date.now() - job.completedAt.getTime();
  const retryDelay = [1, 4, 16][job.retryCount] * 60 * 60 * 1000; // hours to ms

  if (timeSinceFailure >= retryDelay) {
    // Retry sync
    await retrySyncJob(job.id);
  }
}
```

## `syncJobs` Status Flow

```
PENDING → RUNNING → SUCCESS
                  → FAILED → (retry after 1h) → SUCCESS
                                               → FAILED → (retry after 4h) → SUCCESS
                                                                            → FAILED → (retry after 16h) → FAILED_PERMANENT
```

**Status meanings:**

| Status | Meaning |
|---|---|
| `PENDING` | Sync queued but not started |
| `RUNNING` | Sync in progress |
| `SUCCESS` | Sync completed successfully |
| `FAILED` | Sync failed, will retry |
| `FAILED_PERMANENT` | Sync failed 3 times, stopped retrying |

## Local Development Scheduler

For local testing, create a script that triggers the weekly sync every 5 minutes.

**File:** `scripts/dev-scheduler.ts`

```typescript
// Run with: bun run scripts/dev-scheduler.ts
// Triggers weekly sync every 5 minutes for testing

const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("CRON_SECRET not set in .env.local");
  process.exit(1);
}

async function triggerWeeklySync() {
  console.log("[dev-scheduler] Triggering weekly sync...");

  try {
    const response = await fetch("http://localhost:3000/api/cron/weekly-sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    const result = await response.json();
    console.log("[dev-scheduler] Result:", result);
  } catch (error) {
    console.error("[dev-scheduler] Error:", error);
  }
}

// Run immediately on start
triggerWeeklySync();

// Then every 5 minutes
setInterval(triggerWeeklySync, 5 * 60 * 1000);
```

**Add to `package.json` scripts:**
```json
{
  "scripts": {
    "dev": "next dev",
    "dev:scheduler": "bun run scripts/dev-scheduler.ts"
  }
}
```

**Usage:**
```bash
# Terminal 1: Run dev server
bun run dev

# Terminal 2: Run dev scheduler
bun run dev:scheduler
```

## Admin UI Sync Status

**Location:** `src/components/admin/sync-controls.tsx`

**Displays:**
- Last sync time per source
- Last sync error (if any)
- "Sync Now" button per source → `POST /api/sync/[clientId]/[source]`
- "Sync All" button → `POST /api/sync/[clientId]`

**New: Sync history table**

Query `syncJobs` for recent history:
```typescript
const recentSyncs = await db.select()
  .from(syncJobs)
  .where(eq(syncJobs.clientId, clientId))
  .orderBy(desc(syncJobs.createdAt))
  .limit(20);
```

**Display:**

| Source | Status | Started | Completed | Rows | Error |
|---|---|---|---|---|---|
| GA4 | ✅ SUCCESS | 2025-04-14 02:00 | 2025-04-14 02:01 | 90 | — |
| GSC | ✅ SUCCESS | 2025-04-14 02:00 | 2025-04-14 02:02 | 1,234 | — |
| MOZ | ❌ FAILED | 2025-04-14 02:00 | 2025-04-14 02:00 | 0 | Invalid API key |
| DATAFORSEO | ✅ SUCCESS | 2025-04-14 02:00 | 2025-04-14 02:03 | 500 | — |
| RANKSCALE | 🟡 RUNNING | 2025-04-14 02:00 | — | — | — |

**Status badges:**

| Status | Color | Icon |
|---|---|---|
| `SUCCESS` | Green | ✅ |
| `FAILED` | Red | ❌ |
| `FAILED_PERMANENT` | Dark red | 🚫 |
| `RUNNING` | Yellow | 🟡 |
| `PENDING` | Gray | ⏳ |

**"Retry" button for failed syncs:**
Calls `POST /api/sync/[clientId]/[source]` to manually retry.

## Environment Variables

**Required:**
```bash
CRON_SECRET=<random string>   # Generate: openssl rand -base64 32
```

**Add to `.env.local`:**
```bash
# Existing
AUTH_SECRET=<generated>
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=./data/portal.db

# New — required for scheduler
CRON_SECRET=<run: openssl rand -base64 32>
```

**Add to Vercel environment variables:**
1. Go to Vercel dashboard → project → Settings → Environment Variables
2. Add `CRON_SECRET` with the same value as `.env.local`
3. Apply to Production, Preview, and Development environments

## Vercel Deployment

### Step 1: Add `vercel.json` to Project Root

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

### Step 2: Add `CRON_SECRET` to Vercel

1. Vercel dashboard → project → Settings → Environment Variables
2. Add `CRON_SECRET` = `<your secret>`
3. Apply to all environments

### Step 3: Deploy

```bash
git add vercel.json src/app/api/cron/weekly-sync/route.ts
git commit -m "feat: add weekly sync scheduler"
git push origin main
```

Vercel automatically picks up `vercel.json` cron configuration on deploy.

### Step 4: Verify Cron is Active

1. Vercel dashboard → project → Cron Jobs tab
2. Confirm cron shows `0 2 * * 1` schedule for `/api/cron/weekly-sync`
3. Wait for first execution (next Monday 2:00 AM UTC) or trigger manually

### Step 5: Monitor Execution

**Vercel dashboard:**
- Cron Jobs tab shows execution history
- Click on a run to see logs

**Database:**
```bash
sqlite3 ./data/portal.db "SELECT source, status, rows_inserted, error FROM sync_jobs ORDER BY created_at DESC LIMIT 50;"
```

## Manual Trigger (Testing)

**Trigger cron manually via curl:**
```bash
curl -X POST https://your-app.vercel.app/api/cron/weekly-sync \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Or via Vercel dashboard:**
1. Cron Jobs tab → select cron → "Trigger" button

## Monitoring and Alerts

**Recommended monitoring:**
1. **Vercel Cron execution logs** — check for 500 errors
2. **`syncJobs` table** — query for `FAILED_PERMANENT` status
3. **Email alerts** — send email to admin if `failedSyncs > 5` in a single run

**Email alert implementation:**
```typescript
// In weekly-sync route, after aggregating results
if (failedSyncs > 5) {
  await sendEmail({
    to: "admin@bitbrandanarchy.com",
    subject: "Weekly Sync Alert: Multiple Failures",
    body: `${failedSyncs} syncs failed in the latest weekly sync. Check sync_jobs table for details.`,
  });
}
```

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Cron not running | `CRON_SECRET` not set in Vercel | Add `CRON_SECRET` to Vercel environment variables |
| 401 Unauthorized | Wrong `CRON_SECRET` | Verify secret matches in `.env.local` and Vercel |
| All syncs failing | API credentials not configured | Configure credentials in `/admin/settings/api-credentials` |
| Specific source failing | Invalid credentials for that provider | Re-enter credentials in admin UI |
| Sync timeout | Sync taking > 60 seconds | Increase Vercel function timeout (Pro plan required) |
| Database locked | Concurrent writes | Reduce parallelism (lower batch size from 3 to 2) |

## Cost Considerations

**Vercel Cron:**
- Free on Pro plan (up to 100 cron jobs)
- Hobby plan: not available

**API costs per week:**
- GA4: Free (Google Analytics API)
- GSC: Free (Google Search Console API)
- Moz: ~$0.50/week (150 rows × 10 clients = 1,500 rows/month)
- DataForSEO: ~$2-5/week (incremental enrichment, new keywords only)
- Rankscale: TBD (confirm pricing with vendor)

**Total estimated cost:** ~$10-20/week for all integrations

## Next Steps

1. **Create `vercel.json`** with cron configuration
2. **Implement `/api/cron/weekly-sync` route**
3. **Add `CRON_SECRET` to environment variables**
4. **Test locally** with `dev:scheduler` script
5. **Deploy to Vercel**
6. **Monitor first execution** (next Monday 2:00 AM UTC)
7. **Set up email alerts** for failed syncs
