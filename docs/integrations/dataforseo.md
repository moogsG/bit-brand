# DataForSEO Integration

## Overview

DataForSEO provides keyword-level search data sourced directly from Google Ads API, offering the highest accuracy for search volume and keyword metrics. This integration powers the `keyword_research` table enrichment with monthly volume, difficulty, intent classification, and current ranking positions.

## What It Provides

- **Keyword search volume** — sourced directly from Google Ads API (not estimated by third-party crawlers)
- **Keyword difficulty scores** — 0-100 scale indicating ranking difficulty
- **Search intent classification** — informational, navigational, commercial, transactional
- **Current ranking positions** — where a domain ranks for specific keywords
- **Powers:** `keyword_research` table enrichment (`monthlyVolume`, `difficulty`, `intent`, `currentPosition`)

## Why DataForSEO for Keywords

| Advantage | Detail |
|---|---|
| **Google Ads API source** | Direct access to Google's own search volume data — not estimated |
| **Bulk processing** | Up to 1,000 keywords per request |
| **Cost model** | Pay-as-you-go, no monthly commitment — costs drop to near-zero after initial enrichment |
| **Complements Moz** | Moz provides domain-level metrics; DataForSEO provides keyword-level data |

## Authentication

**Method:** HTTP Basic Authentication

```
Authorization: Basic base64(login:password)
```

**Credentials storage:**
- Stored in `apiCredentials` table
- Provider: `DATAFORSEO`
- JSON format: `{ "login": "user@bitbrandanarchy.com", "password": "api_key_here" }`
- No per-client credentials needed — agency-level credentials only

**Base URL:** `https://api.dataforseo.com/v3/`

**Sign up:** [https://app.dataforseo.com](https://app.dataforseo.com) — minimum $50 deposit, pay-as-you-go pricing

## Endpoints Used

### 1. Search Volume for Known Keywords

**Endpoint:** `POST /v3/keywords_data/google_ads/search_volume/live`

**Purpose:** Get search volume, competition, and CPC for a list of keywords

**Request:**
```json
[{
  "keywords": ["acme widgets", "best acme tools"],
  "location_code": 2840,
  "language_code": "en"
}]
```

**Parameters:**
- `keywords` — array of up to 1,000 keywords
- `location_code` — `2840` = United States (default)
- `language_code` — `"en"` = English (default)

**Response fields:**
- `keyword` — the keyword string
- `search_volume` — monthly search volume
- `competition` — 0-1 scale (Google Ads competition)
- `cpc` — cost per click in USD

**Maps to:**
- `keyword_research.monthlyVolume` ← `search_volume`

### 2. Ranked Keywords for a Domain

**Endpoint:** `POST /v3/dataforseo_labs/google/ranked_keywords/live`

**Purpose:** Get all keywords a domain ranks for in top 100 positions

**Request:**
```json
[{
  "target": "acmecorp.com",
  "location_code": 2840,
  "language_code": "en",
  "limit": 1000
}]
```

**Parameters:**
- `target` — domain (no protocol)
- `location_code` — `2840` = United States
- `language_code` — `"en"` = English
- `limit` — max results (up to 1,000)

**Response fields:**
- `keyword` — the keyword string
- `rank_absolute` — position in search results (1-100)
- `search_volume` — monthly search volume
- `keyword_difficulty` — 0-100 scale
- `search_intent` — `informational` | `navigational` | `commercial` | `transactional`

**Maps to:**
- `keyword_research.currentPosition` ← `rank_absolute`
- `keyword_research.difficulty` ← `keyword_difficulty`
- `keyword_research.intent` ← `search_intent` (mapped via enum)
- `keyword_research.monthlyVolume` ← `search_volume`

## Search Intent Mapping

DataForSEO intent values map to the `keyword_research.intent` enum:

| DataForSEO intent | keyword_research.intent enum |
|---|---|
| `informational` | `INFORMATIONAL` |
| `navigational` | `NAVIGATIONAL` |
| `commercial` | `COMMERCIAL` |
| `transactional` | `TRANSACTIONAL` |

## Location and Language Configuration

**Current defaults:**
- `location_code: 2840` (United States)
- `language_code: "en"` (English)

**Future enhancement:**
Make these configurable per client via `dataSources` table. Add columns:
- `dataSources.locationCode` (integer)
- `dataSources.languageCode` (text)

This allows targeting specific geographic markets (e.g. UK, Canada, Australia) per client.

## Standard vs Live Method Decision

DataForSEO offers two methods for most endpoints:
1. **Standard method** — submit task, poll for completion (cheaper, slower)
2. **Live method** — immediate response (more expensive, faster)

**Chosen: Live method**

**Rationale:**
- Weekly sync cadence means we can afford the higher cost for immediate results
- Standard method requires polling logic, adding complexity to sync function
- Live method simplifies sync to single request/response pattern
- Cost difference is minimal at our scale (10 clients × weekly)

## Incremental Enrichment Strategy

> ✅ **CRITICAL for cost control**

Without incremental enrichment:
- 500 keywords/client × 10 clients × weekly sync = ~$160-320/month

With incremental enrichment:
- Initial enrichment: ~$80 one-time
- Ongoing: ~$10-20/month (new keywords only)

### Implementation

**Add column to `keyword_research` table:**
```sql
ALTER TABLE keyword_research ADD COLUMN last_enriched_at INTEGER;
```

**Enrichment logic:**
1. Query `keyword_research` for client where:
   - `lastEnrichedAt IS NULL` (never enriched)
   - OR `lastEnrichedAt < NOW() - 30 days` (stale data)
2. If no keywords need enrichment → skip API calls, return success with 0 rows
3. Batch keywords into groups of 1,000
4. For each batch:
   - Call `search_volume/live`
   - Update `monthlyVolume` + `lastEnrichedAt = NOW()`
5. Call `ranked_keywords/live` with client domain
6. For each returned keyword:
   - If exists in `keyword_research` → update `currentPosition`, `difficulty`, `intent`
7. Keywords NOT in `ranked_keywords` response → set `currentPosition = NULL` (not ranking in top 100)

**Result:** After initial enrichment, only new keywords added by admin trigger API calls.

## Keyword Enrichment Flow

```
1. Query keyword_research for client
   WHERE lastEnrichedAt IS NULL OR lastEnrichedAt < NOW() - 30 days

2. If no keywords need enrichment:
   → Skip API calls
   → Return SyncResult { success: true, rowsInserted: 0 }

3. Batch keywords into groups of 1,000

4. For each batch:
   → POST /v3/keywords_data/google_ads/search_volume/live
   → Update monthlyVolume for each keyword
   → Set lastEnrichedAt = NOW()

5. POST /v3/dataforseo_labs/google/ranked_keywords/live
   → Get all keywords client ranks for

6. For each ranked keyword:
   → If exists in keyword_research:
      → Update currentPosition, difficulty, intent
   → If NOT exists:
      → Skip (don't auto-add keywords)

7. For keywords in keyword_research but NOT in ranked_keywords:
   → Set currentPosition = NULL (not ranking in top 100)

8. Return SyncResult with total rows updated
```

## Cost Estimation

| Scenario | Cost |
|---|---|
| Initial enrichment (500 keywords × 10 clients) | ~$80 one-time |
| Ongoing monthly (new keywords only, ~50/month) | ~$10-20/month |
| Without incremental enrichment (weekly full refresh) | ~$160-320/month |

**Pricing reference:** [https://dataforseo.com/apis/keywords-data-api](https://dataforseo.com/apis/keywords-data-api)

## Error Codes

| Code | Meaning | Action |
|---|---|---|
| `401` | Invalid credentials | "Invalid DataForSEO credentials" — check `apiCredentials` table |
| `402` | Insufficient balance | "DataForSEO account balance too low - add funds at app.dataforseo.com" |
| `40501` | Keyword not found | Skip keyword, continue with others (not an error) |
| `50001` | Internal server error | Retry after 5 minutes |

## Testing Manually

**Trigger sync via API:**
```bash
curl -X POST http://localhost:3000/api/sync/{clientId}/DATAFORSEO
```

**Check sync results:**
```bash
sqlite3 ./data/portal.db "SELECT source, status, rows_inserted, error FROM sync_jobs WHERE source = 'DATAFORSEO' ORDER BY created_at DESC LIMIT 5;"
```

**Verify enriched keywords:**
```bash
sqlite3 ./data/portal.db "SELECT keyword, monthly_volume, difficulty, intent, current_position, last_enriched_at FROM keyword_research WHERE client_id = '{clientId}' LIMIT 10;"
```

## File Location

**Integration file:** `src/lib/integrations/dataforseo.ts` (new file — does not exist yet)

**Required implementation:**
- `syncDataForSeoData(clientId: string): Promise<SyncResult>`
- Helper: `enrichKeywordsWithSearchVolume(clientId: string, keywords: string[])`
- Helper: `updateRankedKeywords(clientId: string, domain: string)`

## Database Schema Impact

**New column:**
```typescript
// In src/lib/db/schema.ts
export const keywordResearch = sqliteTable("keyword_research", {
  // ... existing columns
  lastEnrichedAt: integer("last_enriched_at", { mode: "timestamp" }),
});
```

**Migration:**
```bash
bun run db:generate
bun run db:migrate
```

## Next Steps

1. Add `lastEnrichedAt` column to `keyword_research` table
2. Create `src/lib/integrations/dataforseo.ts`
3. Implement `syncDataForSeoData()` function
4. Add DataForSEO credentials to `apiCredentials` table via admin UI
5. Test with one client before enabling for all 10
6. Monitor costs in DataForSEO dashboard after first week
