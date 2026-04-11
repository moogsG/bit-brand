# Admin Setup Guide

Step-by-step guide for Morgan to set up all integrations from scratch and deploy the portal to production.

## Prerequisites

Before starting, ensure you have:

- ✅ Bun >= 1.1 installed (`curl -fsSL https://bun.sh/install | bash`)
- ✅ Access to BBA's Google Cloud project (or ability to create one)
- ✅ Admin access to all 10 client GA4 properties
- ✅ Admin access to all 10 client Search Console properties
- ✅ Moz account (or ability to create one)
- ✅ DataForSEO account (or ability to create one)
- ✅ Rankscale account (⚠️ contact vendor first to confirm API details)
- ✅ Vercel account for deployment
- ✅ GitHub repository for the codebase

## Step 1: Google Service Account Setup

> ✅ **ACTION REQUIRED:** Complete this before any GA4 or GSC data will sync.

### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select or create the BBA project
3. Navigate to **IAM & Admin → Service Accounts**
4. Click **"Create Service Account"**
   - **Name:** `bba-portal-sync`
   - **Description:** "BBA SEO Portal — reads GA4 and GSC data for client syncs"
5. Click **"Create and Continue"** → skip role assignment → **"Done"**
6. Click the new service account → **Keys** tab → **Add Key → Create new key → JSON**
7. Download the JSON key file — **store this securely, never commit to git**
8. Note the `client_email` value (e.g. `bba-portal-sync@your-project.iam.gserviceaccount.com`)

### Share with GA4 Properties

**Repeat for each of the 10 clients:**

1. Open GA4 → **Admin** → **Property Access Management**
2. Click **"+"** → **Add users**
3. **Email:** paste the service account `client_email`
4. **Role:** Viewer
5. **Save**

### Share with GSC Properties

**Repeat for each of the 10 clients:**

1. Open Search Console → select property → **Settings → Users and permissions**
2. **Add user** → paste service account `client_email`
3. **Permission:** Full (or Restricted)
4. **Save**

### Extract Credentials for Portal

Open the downloaded JSON key file and extract:
- `client_email` — service account email
- `private_key` — RSA private key (starts with `-----BEGIN PRIVATE KEY-----`)

You'll enter these in the portal at `/admin/settings/api-credentials` → GA4 and GSC sections.

## Step 2: Moz API Setup

> ✅ **ACTION REQUIRED:** Sign up for Moz API Growth Medium plan.

### Sign Up

1. Go to [https://moz.com/products/api](https://moz.com/products/api)
2. Sign up for **Growth Medium** plan
   - **Cost:** $75/month
   - **Quota:** 15,000 rows/month
   - **Sufficient for:** 10 clients × 30 days × 50 rows/day = 15,000 rows/month
3. After signup, go to your Moz account → **API credentials**
4. Note your **Access ID** and **Secret Key**

### Enter Credentials in Portal

1. Navigate to `/admin/settings/api-credentials`
2. **Moz** section:
   - **Access ID:** paste from Moz account
   - **Secret Key:** paste from Moz account
3. Click **"Test Connection"** to verify
4. **Save**

## Step 3: DataForSEO Setup

> ✅ **ACTION REQUIRED:** Create account and add funds.

### Create Account

1. Go to [https://app.dataforseo.com](https://app.dataforseo.com)
2. Create an account
3. Add funds — **minimum $50 deposit** (pay-as-you-go, no monthly commitment)
4. Go to **API Access** → note your **Login** (email) and **Password** (API key)

### Enter Credentials in Portal

1. Navigate to `/admin/settings/api-credentials`
2. **DataForSEO** section:
   - **Login:** paste from DataForSEO account (email)
   - **Password:** paste API key
3. Click **"Test Connection"** to verify
4. **Save**

### Cost Monitoring

After first week of syncs, check DataForSEO dashboard to verify costs are within expected range (~$10-20/week with incremental enrichment).

## Step 4: Rankscale Setup

> ⚠️ **WARNING:** The Rankscale API endpoint is currently a placeholder. Do NOT skip this step.

### Contact Rankscale

**Before any implementation work begins on the Rankscale integration:**

1. Contact Rankscale (sales or support)
2. Request API documentation
3. Confirm:
   - API endpoint URL
   - Authentication method (assumed: Bearer token)
   - Request/response schema
   - Rate limits
   - Pricing for 10 clients × 20 prompts × 3 platforms × weekly refresh

### Update Integration File

Once confirmed:
1. Update `src/lib/integrations/rankscale.ts` with actual endpoint details
2. Test with one client before enabling for all 10

### Enter Credentials in Portal

1. Navigate to `/admin/settings/api-credentials`
2. **Rankscale** section:
   - **API Key:** paste from Rankscale account
3. Click **"Test Connection"** to verify
4. **Save**

## Step 5: Install Dependencies

```bash
cd /Users/morgangreff/workspace/bit-brand-anarchy-portal
bun install

# Add Google Auth Library for GA4/GSC service account authentication
bun add google-auth-library
```

## Step 6: Configure Environment Variables

### Local Development

Create or update `.env.local` at project root:

```bash
# Auth
AUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=./data/portal.db

# Scheduler (required for weekly cron)
CRON_SECRET=<run: openssl rand -base64 32>

# Credential encryption (required for production)
ENCRYPTION_KEY=<run: openssl rand -hex 32>

# Email (Resend — optional for POC)
RESEND_API_KEY=
RESEND_FROM=BIT Brand Anarchy <noreply@bitbrandanarchy.com>
```

### Generate Secrets

```bash
# AUTH_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY
openssl rand -hex 32
```

### Production (Vercel)

Add all environment variables to Vercel:
1. Vercel dashboard → project → **Settings → Environment Variables**
2. Add each variable from `.env.local`
3. Apply to **Production**, **Preview**, and **Development** environments

## Step 7: Run Schema Migration

> ⚠️ **BACKUP DATABASE FIRST** if running on existing data.

```bash
# Backup existing database (if it exists)
cp ./data/portal.db ./data/portal.db.backup-$(date +%Y%m%d-%H%M%S)

# Generate migration SQL from schema changes
bun run db:generate

# Review the generated SQL in ./drizzle/migrations/
# Verify it matches expected changes from docs/schema-migration.md

# Apply migrations
bun run db:migrate

# Verify in Drizzle Studio
bun run db:studio
```

### Verify Migration

**Check tables exist:**
```bash
sqlite3 ./data/portal.db ".tables"
# Should include: api_credentials, sync_jobs, moz_metrics
# Should NOT include: ahrefs_metrics, semrush_metrics (if migrating from old schema)
```

**Check data_sources enum:**
```bash
sqlite3 ./data/portal.db "SELECT DISTINCT type FROM data_sources;"
# Should return: GA4, GSC, MOZ, DATAFORSEO, RANKSCALE
```

## Step 8: Build API Credentials Admin UI

> ✅ **ACTION REQUIRED:** Build the new `/admin/settings/api-credentials` page.

### Create Admin UI Page

**File:** `src/app/admin/settings/api-credentials/page.tsx`

**Features:**
- Form for each provider (GA4, GSC, MOZ, DATAFORSEO, RANKSCALE)
- "Test Connection" button per provider
- Credential encryption before saving to DB
- Success/error toast notifications

### API Route for Credential Management

**File:** `src/app/api/settings/api-credentials/route.ts`

**Endpoints:**
- `GET /api/settings/api-credentials` — list all credentials (decrypted)
- `POST /api/settings/api-credentials` — create/update credential
- `POST /api/settings/api-credentials/test` — test connection

### Credential Encryption

**File:** `src/lib/crypto.ts` (new file)

```typescript
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const ALGORITHM = "aes-256-gcm";

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(text: string): string {
  const [ivHex, authTagHex, encrypted] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

**Usage:**
```typescript
import { encrypt, decrypt } from "@/lib/crypto";

// Before saving to DB
const credentialsEnc = encrypt(JSON.stringify({ apiKey: "..." }));

// After reading from DB
const credentials = JSON.parse(decrypt(credentialsEnc));
```

## Step 9: Configure API Credentials in Admin UI

Once the admin UI is built:

### GA4 Credentials

1. Go to `/admin/settings/api-credentials`
2. **GA4** section:
   - **Service Account Email:** paste from JSON key file (`client_email`)
   - **Private Key:** paste from JSON key file (`private_key`)
3. Click **"Test Connection"** to verify
4. **Save**

### GSC Credentials

1. **GSC** section:
   - **Service Account Email:** same as GA4 (or separate if preferred)
   - **Private Key:** same as GA4 (or separate if preferred)
3. Click **"Test Connection"** to verify
4. **Save**

### Moz Credentials

1. **Moz** section:
   - **Access ID:** from Moz account
   - **Secret Key:** from Moz account
3. Click **"Test Connection"** to verify
4. **Save**

### DataForSEO Credentials

1. **DataForSEO** section:
   - **Login:** email from DataForSEO account
   - **Password:** API key from DataForSEO account
3. Click **"Test Connection"** to verify
4. **Save**

### Rankscale Credentials

1. **Rankscale** section:
   - **API Key:** from Rankscale account (after confirming with vendor)
3. Click **"Test Connection"** to verify
4. **Save**

## Step 10: Configure Per-Client Data Sources

For each of the 10 clients:

### Navigate to Client Detail

1. Go to `/admin/clients`
2. Click on a client
3. Scroll to **Data Sources** section

### Configure GA4

1. **GA4** section:
   - **Property ID:** format `properties/123456789` (find in GA4 Admin → Property Settings)
   - Toggle **"Connected"** to ON
2. **Save**

### Configure GSC

1. **GSC** section:
   - **Site URL:** exact URL as shown in Search Console (e.g. `https://www.acmecorp.com/` with trailing slash)
   - Toggle **"Connected"** to ON
2. **Save**

### Configure Moz

1. **Moz** section:
   - Toggle **"Connected"** to ON (no per-client config needed)
2. **Save**

### Configure DataForSEO

1. **DataForSEO** section:
   - Toggle **"Connected"** to ON (no per-client config needed)
2. **Save**

### Configure Rankscale

1. **Rankscale** section:
   - Toggle **"Connected"** to ON (no per-client config needed)
2. **Save**

## Step 11: Run First Manual Sync

For each client, trigger a manual sync to verify everything works.

### Via Admin UI

1. Go to `/admin/clients/[id]`
2. Scroll to **Sync Controls** section
3. Click **"Sync All"** button
4. Wait for completion (check status panel)

### Via API

```bash
# Sync all sources for a client
curl -X POST http://localhost:3000/api/sync/{clientId}

# Or sync a single source
curl -X POST http://localhost:3000/api/sync/{clientId}/GA4
curl -X POST http://localhost:3000/api/sync/{clientId}/GSC
curl -X POST http://localhost:3000/api/sync/{clientId}/MOZ
curl -X POST http://localhost:3000/api/sync/{clientId}/DATAFORSEO
curl -X POST http://localhost:3000/api/sync/{clientId}/RANKSCALE
```

### Check Sync Results

**In database:**
```bash
sqlite3 ./data/portal.db "SELECT source, status, rows_inserted, error FROM sync_jobs ORDER BY created_at DESC LIMIT 20;"
```

**Expected output:**
```
GA4|SUCCESS|90|
GSC|SUCCESS|1234|
MOZ|SUCCESS|1|
DATAFORSEO|SUCCESS|500|
RANKSCALE|SUCCESS|60|
```

**If any sync fails:**
1. Check `error` column in `sync_jobs` table
2. Verify credentials in `/admin/settings/api-credentials`
3. Check API provider dashboard for quota/balance issues
4. See **Troubleshooting** section below

## Step 12: Deploy to Vercel

### Push to GitHub

```bash
git add .
git commit -m "feat: complete integration setup"
git push origin main
```

### Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import GitHub repository
4. **Framework Preset:** Next.js
5. **Root Directory:** `./` (project root)
6. Click **"Deploy"**

### Add Environment Variables

1. Vercel dashboard → project → **Settings → Environment Variables**
2. Add all variables from `.env.local`:
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` (change to production URL: `https://your-app.vercel.app`)
   - `DATABASE_URL` (change to production database path or use Vercel Postgres)
   - `CRON_SECRET`
   - `ENCRYPTION_KEY`
   - `RESEND_API_KEY` (if using Resend for emails)
   - `RESEND_FROM`
3. Apply to **Production**, **Preview**, and **Development** environments
4. **Redeploy** after adding environment variables

### Verify Vercel Cron

1. Vercel dashboard → project → **Cron Jobs** tab
2. Confirm cron shows `0 2 * * 1` schedule for `/api/cron/weekly-sync`
3. Cron will run every Monday at 2:00 AM UTC

### Test Production Deployment

1. Visit production URL: `https://your-app.vercel.app`
2. Log in as admin
3. Navigate to `/admin/clients/[id]`
4. Trigger a manual sync
5. Verify data appears in client portal

## Step 13: Set Up Database for Production

> ⚠️ **IMPORTANT:** SQLite is not recommended for production on Vercel (ephemeral filesystem).

### Option 1: Vercel Postgres (Recommended)

1. Vercel dashboard → project → **Storage** tab
2. Click **"Create Database"** → **Postgres**
3. Note the connection string
4. Update `DATABASE_URL` in Vercel environment variables
5. Update `drizzle.config.ts` to use `pg` driver instead of `better-sqlite3`
6. Update `src/lib/db/index.ts` to use `postgres.js` or `pg`
7. Run migrations on production database:
   ```bash
   DATABASE_URL=<vercel-postgres-url> bun run db:migrate
   ```

### Option 2: External PostgreSQL (e.g. Supabase, Railway)

1. Create a PostgreSQL database on your preferred provider
2. Note the connection string
3. Follow same steps as Option 1

### Option 3: Keep SQLite (Not Recommended)

If you must use SQLite on Vercel:
- Use Vercel Blob Storage to persist the database file
- Implement a sync mechanism to upload/download the DB file on each request
- **This is complex and not recommended for production**

## Troubleshooting

### GA4 Sync: 403 Access Denied

**Cause:** Service account not shared with GA4 property

**Fix:**
1. Open GA4 → Admin → Property Access Management
2. Verify service account email is listed with Viewer role
3. If not, add it (see Step 1)

### GSC Sync: 404 Site URL Not Found

**Cause:** Wrong URL format in `propertyIdentifier`

**Fix:**
1. Check exact URL in Search Console
2. Must match including protocol and trailing slash
3. Examples:
   - `https://www.acmecorp.com/` (with trailing slash)
   - `sc-domain:acmecorp.com` (domain property)

### Moz Sync: 401 Unauthorized

**Cause:** Wrong Access ID or Secret Key

**Fix:**
1. Re-enter credentials in `/admin/settings/api-credentials`
2. Verify credentials in Moz account → API credentials
3. Click "Test Connection" to verify

### DataForSEO Sync: 402 Insufficient Balance

**Cause:** Account balance too low

**Fix:**
1. Go to [app.dataforseo.com](https://app.dataforseo.com)
2. Add funds (minimum $50)
3. Retry sync

### Rankscale Sync: Connection Error

**Cause:** Placeholder endpoint not updated

**Fix:**
1. Contact Rankscale to confirm actual API endpoint
2. Update `src/lib/integrations/rankscale.ts` with confirmed details
3. Retry sync

### Cron Not Running

**Cause:** `CRON_SECRET` not set in Vercel

**Fix:**
1. Vercel dashboard → project → Settings → Environment Variables
2. Add `CRON_SECRET` with same value as `.env.local`
3. Redeploy

### Database Migration Fails

**Cause:** Schema conflict or missing backup

**Fix:**
1. Restore backup: `cp ./data/portal.db.backup-YYYYMMDD-HHMMSS ./data/portal.db`
2. Review migration SQL in `./drizzle/migrations/`
3. Fix schema conflicts in `src/lib/db/schema.ts`
4. Re-run `bun run db:generate` and `bun run db:migrate`

## Post-Setup Checklist

- [ ] Google service account created and shared with all 10 client GA4 properties
- [ ] Google service account shared with all 10 client GSC properties
- [ ] Moz API credentials configured and tested
- [ ] DataForSEO account created, funded, and credentials configured
- [ ] Rankscale API confirmed with vendor and credentials configured
- [ ] All environment variables set in `.env.local` and Vercel
- [ ] Schema migration completed successfully
- [ ] API credentials admin UI built and tested
- [ ] All 10 clients configured with data sources
- [ ] Manual sync tested for each client
- [ ] Deployed to Vercel
- [ ] Production database configured (Vercel Postgres or external)
- [ ] Vercel Cron verified and scheduled
- [ ] First weekly sync completed successfully

## Next Steps

1. **Monitor first week of syncs** — check `sync_jobs` table daily
2. **Verify costs** — check Moz, DataForSEO, Rankscale dashboards
3. **Set up email alerts** — notify admin if syncs fail
4. **Onboard first client** — invite client user, show them the portal
5. **Iterate based on feedback** — adjust sync frequency, add features

## Support Resources

| Provider | Support URL |
|---|---|
| Google Cloud | [https://cloud.google.com/support](https://cloud.google.com/support) |
| Moz | [https://moz.com/help](https://moz.com/help) |
| DataForSEO | [https://dataforseo.com/contact](https://dataforseo.com/contact) |
| Rankscale | Contact sales/support team |
| Vercel | [https://vercel.com/support](https://vercel.com/support) |
