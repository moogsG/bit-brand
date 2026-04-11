# Rankscale Integration — AI Visibility

> ⚠️ **WARNING:** This integration has a confirmed placeholder endpoint. Morgan must contact Rankscale to confirm the actual API details before implementation can proceed.

## Overview

Rankscale provides AI visibility tracking across ChatGPT, Perplexity, and Gemini. This integration powers the AI Search Visibility dashboard — a key differentiator for BIT Brand Anarchy's client offering.

## Why AI Visibility Matters

- **HIGH priority selling point** for BBA
- Clients want to know if their brand appears when users ask ChatGPT, Perplexity, or Gemini about their industry
- Powers the **AI Search Visibility dashboard** — a unique feature that sets BBA apart from competitors
- Demonstrates agency's forward-thinking approach to SEO in the AI era

## What It Provides

- **Per-prompt visibility** across ChatGPT, Perplexity, Gemini
- **Position in AI response** (if visible)
- **Response snippet** (what the AI said about the brand)
- **Visibility score** (0-100 scale)
- **Powers:**
  - AI Visibility dashboard (overall score card, trend chart, prompt results table)
  - AI Visibility section in monthly reports

## ⚠️ UNCONFIRMED — What Morgan Must Verify with Rankscale

Before implementation can proceed, contact Rankscale sales/support to confirm:

1. **Actual API endpoint URL**
   - Current placeholder: `https://api.rankscale.io/v1/visibility`
   - This is a best-guess — must be confirmed

2. **Authentication method**
   - Assumed: Bearer token (`Authorization: Bearer {apiKey}`)
   - Must confirm actual auth mechanism

3. **Request schema**
   - How to pass domain + prompts + platforms
   - Field names, data types, required vs optional parameters

4. **Response schema**
   - Field names for visibility data
   - Data types (boolean, integer, string)
   - Visibility score range (assumed 0-100)

5. **Rate limits**
   - Requests per minute/hour/day
   - Concurrent request limits

6. **Pricing**
   - Cost for 10 clients × 20 prompts × 3 platforms × weekly refresh
   - Any volume discounts or monthly caps

**Contact:** Rankscale sales or support team

**Do NOT proceed with implementation until these details are confirmed.**

## Assumed Authentication

> 📝 **NOTE:** This is the assumed auth method — must be confirmed with Rankscale.

**Method:** Bearer token

```
Authorization: Bearer {apiKey}
```

**Credentials storage:**
- Stored in `apiCredentials` table
- Provider: `RANKSCALE`
- JSON format: `{ "apiKey": "rks_abc123..." }`
- No per-client credentials needed — agency-level credentials only

## Prompt Derivation Strategy

Rather than hardcoding prompts or requiring admin configuration, prompts are **derived automatically** from each client's `keyword_research` table.

**Logic:**
1. Query `keyword_research` for `clientId` where:
   - `status IN ('TARGETING', 'RANKING')`
   - AND `priority IN ('HIGH', 'MEDIUM')`
2. Order by `priority` DESC (HIGH first), then `monthlyVolume` DESC
3. Take top 20 keywords
4. Use these keywords as prompts sent to Rankscale
5. If fewer than 20 qualifying keywords, pad with default prompts:
   - `"{client name} reviews"`
   - `"best {industry} companies"`
   - `"top {industry} services"`

**Rationale:**
- Automatically tests the keywords clients care most about
- No manual prompt configuration required
- Prompts evolve as keyword strategy changes
- Focuses on high-value, actively targeted keywords

## Platforms Tested

- **ChatGPT** (OpenAI)
- **Perplexity** (Perplexity AI)
- **Gemini** (Google)

## Assumed Request Structure

> 📝 **NOTE:** This is the assumed request format — must be confirmed with Rankscale.

```json
{
  "domain": "acmecorp.com",
  "prompts": ["best acme widgets", "acme corp reviews"],
  "platforms": ["ChatGPT", "Perplexity", "Gemini"]
}
```

## Response Mapping to `rankscale_metrics` Table

One row is inserted per prompt × platform combination.

| Response field (assumed) | rankscale_metrics column |
|---|---|
| `prompt` | `prompt` |
| `platform` | `platform` |
| `is_visible` | `isVisible` |
| `position` | `position` |
| `response_snippet` | `responseSnippet` |
| `visibility_score` | `visibilityScore` |
| (sync date) | `date` |

**Example:**
- 20 prompts × 3 platforms = 60 rows inserted per sync

## AI Visibility Aggregate Calculation

After inserting `rankscale_metrics` rows, the `updateAiVisibilityAggregate()` function computes aggregate scores for the `aiVisibility` table.

**Function:** `updateAiVisibilityAggregate(clientId: string, date: string)`

**Location:** `src/lib/integrations/rankscale.ts`

**Calculation:**
```typescript
// Query all rankscale_metrics for this client + date
const metrics = await db.select()
  .from(rankscaleMetrics)
  .where(and(
    eq(rankscaleMetrics.clientId, clientId),
    eq(rankscaleMetrics.date, date)
  ));

// Compute aggregates
const totalPromptsTested = new Set(metrics.map(m => m.prompt)).size;
const promptsVisible = new Set(
  metrics.filter(m => m.isVisible).map(m => m.prompt)
).size;
const rankscaleScore = metrics.reduce((sum, m) => sum + m.visibilityScore, 0) / metrics.length;

// Upsert into aiVisibility table
await db.insert(aiVisibility).values({
  clientId,
  date,
  overallScore: rankscaleScore, // secondaryScore is NULL
  rankscaleScore,
  secondaryScore: null,
  totalPromptsTested,
  promptsVisible,
}).onConflictDoUpdate({
  target: [aiVisibility.clientId, aiVisibility.date],
  set: {
    rankscaleScore,
    overallScore: rankscaleScore,
    totalPromptsTested,
    promptsVisible,
  }
});
```

## `aiVisibility.secondaryScore` Field

**Previous name:** `semrushScore` (SEMrush integration dropped)

**Current status:** Renamed to `secondaryScore`, always `NULL`

**Purpose:** Reserved for a future second AI visibility provider

**Future behavior:**
When a second provider is added:
```typescript
overallScore = (rankscaleScore + secondaryScore) / 2
```

Currently:
```typescript
overallScore = rankscaleScore
```

## Dashboard Data Queries

### Overall Score Card

**Query:** Latest `aiVisibility.overallScore` for client

```typescript
const latestScore = await db.select()
  .from(aiVisibility)
  .where(eq(aiVisibility.clientId, clientId))
  .orderBy(desc(aiVisibility.date))
  .limit(1);
```

**Display:** Large score card with 0-100 value and trend indicator

### Trend Chart

**Query:** `aiVisibility` rows for client where `date >= 6 months ago`

```typescript
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

const trendData = await db.select()
  .from(aiVisibility)
  .where(and(
    eq(aiVisibility.clientId, clientId),
    gte(aiVisibility.date, sixMonthsAgo.toISOString().split('T')[0])
  ))
  .orderBy(asc(aiVisibility.date));
```

**Display:** Line chart plotting `overallScore` over time (Recharts `LineChart`)

### Prompt Results Table

**Query:** Latest `rankscale_metrics` rows for client

```typescript
// Get the latest sync date
const latestDate = await db.select({ date: rankscaleMetrics.date })
  .from(rankscaleMetrics)
  .where(eq(rankscaleMetrics.clientId, clientId))
  .orderBy(desc(rankscaleMetrics.date))
  .limit(1);

// Get all metrics for that date
const promptResults = await db.select()
  .from(rankscaleMetrics)
  .where(and(
    eq(rankscaleMetrics.clientId, clientId),
    eq(rankscaleMetrics.date, latestDate[0].date)
  ))
  .orderBy(asc(rankscaleMetrics.prompt));
```

**Display:** Table grouped by prompt, showing per-platform visibility:

| Prompt | ChatGPT | Perplexity | Gemini | Visibility Score |
|---|---|---|---|---|
| best acme widgets | ✅ Pos 2 | ✅ Pos 1 | ❌ Not visible | 67 |
| acme corp reviews | ✅ Pos 3 | ❌ Not visible | ✅ Pos 4 | 45 |

## File Location

**Integration file:** `src/lib/integrations/rankscale.ts`

**Current status:** Stub exists — needs update once endpoint confirmed

**Required implementation:**
- `syncRankscaleData(clientId: string): Promise<SyncResult>`
- `updateAiVisibilityAggregate(clientId: string, date: string): Promise<void>`
- Helper: `derivePromptsFromKeywords(clientId: string): Promise<string[]>`

## Database Schema

**Tables affected:**
- `rankscale_metrics` — per-prompt visibility data
- `ai_visibility` — aggregated scores

**Schema:**
```typescript
// rankscale_metrics
export const rankscaleMetrics = sqliteTable("rankscale_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  prompt: text("prompt").notNull(),
  platform: text("platform").notNull(), // ChatGPT | Perplexity | Gemini
  isVisible: integer("is_visible", { mode: "boolean" }).notNull(),
  position: integer("position"),
  responseSnippet: text("response_snippet"),
  visibilityScore: integer("visibility_score").notNull(), // 0-100
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// ai_visibility
export const aiVisibility = sqliteTable("ai_visibility", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  overallScore: integer("overall_score").notNull(), // 0-100
  rankscaleScore: integer("rankscale_score").notNull(), // 0-100
  secondaryScore: integer("secondary_score"), // NULL (reserved for future provider)
  totalPromptsTested: integer("total_prompts_tested").notNull(),
  promptsVisible: integer("prompts_visible").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueClientDate: unique().on(table.clientId, table.date),
}));
```

## What to Do Right Now

1. **Contact Rankscale** — sales or support team
2. **Request API documentation** — endpoint, auth, request/response schema, rate limits, pricing
3. **Update `src/lib/integrations/rankscale.ts`** with confirmed details
4. **Test with one client** before enabling for all 10
5. **Monitor costs** in Rankscale dashboard after first week

## Testing Manually

**After endpoint is confirmed:**

```bash
# Trigger sync via API
curl -X POST http://localhost:3000/api/sync/{clientId}/RANKSCALE

# Check sync results
sqlite3 ./data/portal.db "SELECT source, status, rows_inserted, error FROM sync_jobs WHERE source = 'RANKSCALE' ORDER BY created_at DESC LIMIT 5;"

# Verify prompt results
sqlite3 ./data/portal.db "SELECT prompt, platform, is_visible, position, visibility_score FROM rankscale_metrics WHERE client_id = '{clientId}' ORDER BY date DESC LIMIT 20;"

# Verify aggregate scores
sqlite3 ./data/portal.db "SELECT date, overall_score, rankscale_score, total_prompts_tested, prompts_visible FROM ai_visibility WHERE client_id = '{clientId}' ORDER BY date DESC LIMIT 5;"
```

## Known Limitations

- **Placeholder endpoint** — cannot test until Rankscale confirms API details
- **No historical data** — first sync will be the baseline (no trend chart until week 2)
- **Prompt limit** — currently capped at 20 prompts per client (configurable)
- **No prompt customization** — prompts are auto-derived from keywords (admin cannot override)

## Future Enhancements

1. **Admin prompt override** — allow admins to manually specify prompts per client
2. **Second AI visibility provider** — populate `secondaryScore` field
3. **Platform-specific scoring** — weight ChatGPT higher than Perplexity/Gemini
4. **Competitor comparison** — track competitor visibility for same prompts
