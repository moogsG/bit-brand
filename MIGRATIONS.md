# Database Migrations

## Migration History

### 0000_yummy_dexter_bennett.sql (Initial Schema)
- Created all base tables: users, clients, client_users, invitations
- Created data_sources with old credential fields (credentials_enc, property_id, site_url, access_token, refresh_token, token_expires_at)
- Created metrics tables: ga4_metrics, gsc_metrics, ahrefs_metrics, semrush_metrics
- Created keyword_research, seo_strategies, monthly_reports
- Created ai_visibility with semrush_score
- Created rankscale_metrics

### 0001_mysterious_hex.sql (Agency-Level Credentials + New Providers)
**Added:**
- `api_credentials` table — agency-level encrypted credentials for all providers
- `sync_jobs` table — job tracking for scheduled and manual syncs
- `moz_metrics` table — Moz API data (replaces Ahrefs)

**Modified:**
- `ai_visibility.secondary_score` (integer) — added for future secondary AI visibility metric
- `data_sources.property_identifier` (text) — unified property/site identifier field
- `keyword_research.last_enriched_at` (timestamp) — tracks when keyword data was last enriched from DataForSEO

### 0002_lyrical_amphibian.sql (Cleanup Old Provider Schema)
**Removed:**
- `ahrefs_metrics` table — replaced by Moz
- `semrush_metrics` table — replaced by DataForSEO + Rankscale
- `ai_visibility.semrush_score` column — no longer needed
- `data_sources.credentials_enc` — moved to agency-level api_credentials
- `data_sources.property_id` — replaced by property_identifier
- `data_sources.site_url` — replaced by property_identifier
- `data_sources.access_token` — moved to agency-level api_credentials
- `data_sources.refresh_token` — moved to agency-level api_credentials
- `data_sources.token_expires_at` — moved to agency-level api_credentials

## Current Schema State

### Provider Architecture
- **Agency-level credentials:** Stored in `api_credentials` table (encrypted with ENCRYPTION_KEY)
- **Per-client configuration:** Stored in `data_sources` table (property IDs, enabled sources)
- **Supported providers:** GA4, GSC, Moz, DataForSEO, Rankscale

### Key Tables
| Table | Purpose |
|-------|---------|
| `api_credentials` | Agency-level encrypted API keys/tokens (one per provider) |
| `data_sources` | Per-client source configuration (property IDs, sync status) |
| `sync_jobs` | Job tracking for all sync operations |
| `moz_metrics` | Domain Authority, backlinks, referring domains |
| `keyword_research` | Client keyword lists with enrichment tracking |
| `ai_visibility` | Aggregated AI visibility scores with secondary metric |

## Running Migrations

```bash
# Apply all pending migrations
bun run db:migrate

# Generate new migration after schema changes
bun run db:generate

# View current schema in Drizzle Studio
bun run db:studio
```

## Environment Requirements

**REQUIRED before running migrations:**
```bash
# Generate encryption key for api_credentials
openssl rand -hex 32

# Add to .env.local
ENCRYPTION_KEY=<64-character-hex-string>
```

Without `ENCRYPTION_KEY`, the application will throw an error when attempting to encrypt/decrypt API credentials.
