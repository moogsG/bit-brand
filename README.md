# BIT Brand Anarchy SEO Client Portal

A white-label SEO client portal that gives each client a private, authenticated view of their SEO performance data, strategy documents, and monthly reports.

---

## What It Is

A production-ready Next.js application built for BIT Brand Anarchy (BBA), an SEO agency. The portal provides clients with real-time access to their SEO metrics, keyword research, AI search visibility, and monthly performance reports — all managed by the BBA admin team.

## What It Does

### Admin Side
- Create and manage client accounts
- Connect data sources (GA4, GSC, Moz, DataForSEO, Rankscale)
- Manage keyword research lists per client
- Write and publish SEO strategies
- Create monthly reports with auto-populated metrics
- Trigger manual or scheduled data syncs
- Invite client users via email
- Impersonate client view for QA

### Client Side
- View live KPI cards (traffic, clicks, domain authority, AI visibility)
- Interactive traffic and search performance charts
- Keyword research table with sorting and filtering
- Published SEO strategy documents
- Monthly reports with PDF/CSV/Google Sheets export
- AI search visibility dashboard with prompt-level results

---

## Tech Stack

| Package | Version | Role |
|---------|---------|------|
| `next` | `16.2.2` | Framework (App Router) |
| `react` / `react-dom` | `19.2.4` | UI runtime |
| `next-auth` | `^5.0.0-beta.30` | Authentication (v5 beta) |
| `drizzle-orm` | `^0.45.2` | ORM |
| `better-sqlite3` | `^12.8.0` | SQLite driver |
| `drizzle-kit` | `^0.31.10` | Migration tooling |
| `bcryptjs` | `^3.0.3` | Password hashing |
| `zod` | `^4.3.6` | Runtime validation |
| `react-hook-form` | `^7.72.0` | Form state |
| `recharts` | `^3.8.1` | Charts |
| `jspdf` | `^4.2.1` | PDF generation |
| `xlsx` | `^0.18.5` | Spreadsheet export |
| `tailwindcss` | `^4` | CSS framework |
| `typescript` | `^5` | Type system |

**Runtime:** Bun (package manager and script runner)

---

## Quick Start

### Prerequisites

- **Bun** >= 1.1 ([install](https://bun.sh))
- **Node.js** >= 20 (for `tsx` scripts)

### Install

```bash
cd /Users/morgangreff/workspace/bit-brand-anarchy-portal
bun install
```

### Database Setup

```bash
# 1. Generate migrations from schema
bun run db:generate

# 2. Apply migrations
bun run db:migrate

# 3. Seed demo data
bun run db:seed
```

The SQLite database is created at `./data/portal.db`.

### Dev Server

```bash
bun run dev
# Runs on http://localhost:3000
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bitbrandanarchy.com` | `admin123!` |
| Client | `client@acmecorp.com` | `client123!` |

### Where to Go First

| URL | What You'll See |
|-----|-----------------|
| `http://localhost:3000/login` | Login page |
| `http://localhost:3000/admin/dashboard` | Admin overview |
| `http://localhost:3000/portal/acme-corp/dashboard` | Demo client portal |

---

## Integration Stack

| Provider | Cost | Purpose |
|----------|------|---------|
| **GA4 API** | $0 | Traffic data (sessions, users, pageviews, bounce rate) |
| **GSC API** | $0 | Search performance (queries, clicks, impressions, CTR, position) |
| **Moz API** | $75/mo | Domain Authority, backlinks, referring domains |
| **DataForSEO API** | ~$10-20/mo | Keyword volume, difficulty, SERP positions |
| **Rankscale API** | TBD | AI search visibility (ChatGPT, Perplexity, Gemini) |
| **Total** | **~$85-95/mo + Rankscale** | vs Ahrefs ($449/mo) |

All integrations use **agency-level credentials** stored in the `apiCredentials` table. Per-client configuration (property IDs, site URLs, enabled sources) is stored in the `dataSources` table.

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login + invite acceptance
│   ├── admin/                    # Admin-only section (ADMIN role required)
│   │   ├── dashboard/            # Client list, stats
│   │   ├── clients/[id]/         # Client management, data sources, keywords, reports, strategy
│   │   └── settings/             # Password change, data export
│   ├── api/                      # API routes (server-side)
│   │   ├── auth/                 # NextAuth handlers
│   │   ├── clients/              # Client CRUD
│   │   ├── keywords/             # Keyword CRUD + import
│   │   ├── reports/              # Report CRUD + refresh
│   │   ├── strategies/           # Strategy CRUD
│   │   ├── sync/                 # Data sync triggers
│   │   ├── export/               # CSV + Google Sheets export
│   │   └── cron/                 # Vercel Cron endpoints
│   ├── portal/[clientSlug]/      # Client-facing portal
│   │   ├── dashboard/            # KPI cards, charts
│   │   ├── keywords/             # Keyword research table
│   │   ├── strategy/             # SEO strategy docs
│   │   ├── reports/              # Monthly reports
│   │   └── ai-visibility/        # AI visibility dashboard
│   ├── globals.css               # Global styles + CSS custom properties
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Root redirect
│
├── components/
│   ├── admin/                    # Admin-specific components
│   ├── portal/                   # Portal-specific components
│   └── ui/                       # shadcn/ui primitives
│
├── lib/
│   ├── auth/                     # NextAuth config (edge-safe split)
│   ├── db/                       # Drizzle ORM + schema + migrations
│   ├── email/                    # Resend email sending
│   ├── export/                   # PDF + CSV generators
│   ├── integrations/             # GA4, GSC, Moz, DataForSEO, Rankscale sync functions
│   ├── reports/                  # Report auto-data aggregation
│   ├── theme.config.ts           # Brand config
│   └── utils.ts                  # Utility functions
│
└── proxy.ts                      # Next.js middleware (Edge Runtime)
```

---

## Environment Variables

Create a `.env.local` file at the project root:

```bash
# Auth (REQUIRED)
AUTH_SECRET=                      # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Database (REQUIRED)
DATABASE_URL=./data/portal.db

# Email (Optional — blank = console.log mode)
RESEND_API_KEY=
RESEND_FROM=BIT Brand Anarchy <noreply@bitbrandanarchy.com>

# Google OAuth (Optional — not yet implemented)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Vercel Cron (REQUIRED for production)
CRON_SECRET=                      # Random secret for cron endpoint auth

# Credential Encryption (REQUIRED for production)
ENCRYPTION_KEY=                   # 32-byte hex key (64 hex chars)
```

> ⚠️ **WARNING:** Never commit `.env.local` to version control.

---

## Common Commands

### Development

```bash
bun run dev          # Start dev server on http://localhost:3000
bun run build        # Production build
bun run start        # Start production server
bun run lint         # Run ESLint
```

### Database

```bash
bun run db:generate  # Generate SQL migration files from schema changes
bun run db:migrate   # Apply pending migrations to portal.db
bun run db:seed      # Seed demo data (admin user, Acme Corp client, 90 days of metrics)
bun run db:studio    # Open Drizzle Studio at https://local.drizzle.studio
```

### Inspecting the Database

```bash
# Open SQLite shell
sqlite3 ./data/portal.db

# Useful queries
sqlite3 ./data/portal.db ".tables"
sqlite3 ./data/portal.db "SELECT * FROM users;"
sqlite3 ./data/portal.db "SELECT * FROM clients;"
sqlite3 ./data/portal.db "SELECT type, isConnected, lastSyncedAt FROM data_sources;"
```

### Resetting the Database

```bash
# Full reset: delete DB, re-migrate, re-seed
rm ./data/portal.db && bun run db:migrate && bun run db:seed
```

---

## Key Gotchas

### Next.js 16 Changes

**Middleware file is `src/proxy.ts` not `middleware.ts`**
Next.js 16 changed the default middleware filename. Do not create `middleware.ts` — it will be ignored.

**Dynamic route params must be awaited**
In Next.js 16 / React 19, dynamic route params are a Promise:

```typescript
// ✅ Correct
export default async function Page({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params;
}

// ❌ WRONG — will throw in Next.js 16
export default async function Page({ params }: { params: { clientSlug: string } }) {
  const { clientSlug } = params; // breaks
}
```

### NextAuth v5 Beta

NextAuth v5 has a different API surface from v4:
- `auth()` is called directly as a function (no `getServerSession`)
- Handlers are exported from `src/app/api/auth/[...nextauth]/route.ts`
- Import `auth` from `@/lib/auth` (not from `next-auth`)

### Edge Runtime Constraints

`src/proxy.ts` runs on the Edge Runtime and **cannot use Node.js APIs**:

```typescript
// ❌ NEVER import these in proxy.ts or files it imports
import { db } from "@/lib/db"           // uses better-sqlite3 (Node.js)
import { auth } from "@/lib/auth"       // uses bcryptjs (Node.js)

// ✅ Use edge-safe config instead
import { authConfig } from "@/lib/auth/config"  // pure JS, no Node.js
```

### Browser-Only Code

**`src/lib/export/pdf.ts` is browser-only**
Never import this file in server components, API routes, or server actions. It uses `jsPDF` which depends on browser APIs (`document`, `URL.createObjectURL`).

```typescript
// ✅ Correct — dynamic import in "use client" component
const { generateReportPDF } = await import("@/lib/export/pdf");

// ❌ WRONG — top-level import in server component
import { generateReportPDF } from "@/lib/export/pdf";
```

### Database Driver

**`better-sqlite3` is synchronous**
All Drizzle calls with this driver are sync at the SQLite level but wrapped in async functions for API compatibility. Do not use async SQLite drivers.

---

## Full Documentation

For complete documentation including:
- Database schema and table relationships
- Authentication and role-based access control
- Route map and API endpoints
- Admin features and workflows
- Client portal features
- Data integration architecture
- Export system (PDF, CSV, Google Sheets)
- Branding and theme system
- Step-by-step guides for adding clients and features
- Known TODOs and limitations

**See:** [`AGENTS.md`](./AGENTS.md)

**Integration documentation:** [`docs/integrations/overview.md`](./docs/integrations/overview.md)

---

## License

Proprietary — BIT Brand Anarchy internal use only.
