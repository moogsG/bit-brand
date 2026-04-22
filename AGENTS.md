<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — BIT Brand Anarchy SEO Client Portal

Single source of truth for any agent or developer picking up this codebase cold. Read this before touching anything.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Getting Started](#3-getting-started)
4. [Project Structure](#4-project-structure)
5. [Database](#5-database)
6. [Authentication & Roles](#6-authentication--roles)
7. [Route Map](#7-route-map)
8. [Admin Features](#8-admin-features)
9. [Client Portal Features](#9-client-portal-features)
10. [Data Integrations](#10-data-integrations)
11. [Export System](#11-export-system)
12. [Branding / Theme System](#12-branding--theme-system)
13. [Email](#13-email)
14. [Environment Variables](#14-environment-variables)
15. [Adding a New Client (Step-by-Step)](#15-adding-a-new-client-step-by-step)
16. [Adding a New Feature (Agent Instructions)](#16-adding-a-new-feature-agent-instructions)
17. [Known TODOs / Limitations](#17-known-todos--limitations)
18. [Common Commands Reference](#18-common-commands-reference)

---

## 1. Project Overview

**What it is:** A white-label SEO client portal built for BIT Brand Anarchy (BBA), an SEO agency. The portal gives each client a private, authenticated view of their SEO performance data, strategy documents, monthly reports, and AI search visibility metrics — all managed by the BBA admin team.

**What it does:**

- **Admin side:** Admins create client accounts, connect data sources (GA4, GSC, Moz, DataForSEO, Rankscale), manage keyword research, write SEO strategies and monthly reports, trigger manual data syncs, and invite client users via email.
- **Client side:** Clients log in to a dedicated portal scoped to their account (`/portal/[clientSlug]/`) where they can view live KPI cards, traffic/search charts, their keyword research list, the published SEO strategy, monthly reports with export functionality, and an AI visibility dashboard.

**Current status:** Proof-of-concept (POC). Running on local SQLite, seeded with realistic demo data. Not yet deployed. All integrations are structurally complete but require real API credentials to pull live data.

---

## 2. Tech Stack

### Exact Versions (from `package.json`)

| Package | Version | Role |
|---|---|---|
| `next` | `16.2.2` | Framework (App Router) |
| `react` / `react-dom` | `19.2.4` | UI runtime |
| `next-auth` | `^5.0.0-beta.30` | Authentication (v5 beta) |
| `drizzle-orm` | `^0.45.2` | ORM |
| `better-sqlite3` | `^12.8.0` | SQLite driver |
| `drizzle-kit` | `^0.31.10` | Migration tooling |
| `bcryptjs` | `^3.0.3` | Password hashing |
| `zod` | `^4.3.6` | Runtime validation |
| `react-hook-form` | `^7.72.0` | Form state |
| `@hookform/resolvers` | `^5.2.2` | Zod/RHF integration |
| `recharts` | `^3.8.1` | Charts |
| `jspdf` | `^4.2.1` | PDF generation (client-side) |
| `jspdf-autotable` | `^5.0.7` | PDF tables |
| `xlsx` | `^0.18.5` | Spreadsheet (Google Sheets export) |
| `shadcn` | `^4.1.2` | Component generator |
| `@base-ui/react` | `^1.3.0` | Headless UI primitives |
| `@radix-ui/react-icons` | `^1.3.2` | Icon set |
| `lucide-react` | `^1.7.0` | Icon set |
| `sonner` | `^2.0.7` | Toast notifications |
| `next-themes` | `^0.4.6` | Dark/light mode |
| `clsx` | `^2.1.1` | Class merging |
| `class-variance-authority` | `^0.7.1` | CVA variants |
| `tailwind-merge` | `^3.5.0` | Tailwind class dedup |
| `tailwindcss` | `^4` | CSS framework |
| `tw-animate-css` | `^1.4.0` | Animation utilities |
| `tsx` | `^4.21.0` | TypeScript script runner |
| `typescript` | `^5` | Type system |

### Runtime

Bun is the package manager and script runner. Do not use `npm` or `yarn`.

```bash
# Install
bun install

# Run scripts
bun run dev
bun run db:seed
```

### Critical Gotchas

**Next.js 16 uses `proxy.ts` not `middleware.ts`.**
The middleware file in this project is `src/proxy.ts`. Next.js 16 changed the default middleware filename. Do not create `middleware.ts` — it will be ignored.

**`params` in dynamic routes must be awaited.**
In Next.js 16 / React 19, dynamic route params are a Promise. Always await them:

```typescript
// Correct
export default async function Page({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params;
}

// WRONG — will throw in Next.js 16
export default async function Page({ params }: { params: { clientSlug: string } }) {
  const { clientSlug } = params; // breaks
}
```

**NextAuth v5 beta** has a different API surface from v4. `auth()` is called directly as a function (no `getServerSession`). Handlers are exported from `src/app/api/auth/[...nextauth]/route.ts`. Import `auth` from `@/lib/auth` (not from `next-auth`).

**`better-sqlite3` is synchronous.** All Drizzle calls with this driver are sync at the SQLite level but wrapped in async functions for API compatibility. Do not use async SQLite drivers.

**`jsPDF` is browser-only.** Never import `src/lib/export/pdf.ts` in server components, API routes, or server actions. It uses `document`, `URL.createObjectURL`, etc.

**`"use client"` placement:** All chart components (Recharts), export button components, dialog components, and form components must be `"use client"`. Server components fetch data and pass it as props. Do not call `db` in client components.

---

## 3. Getting Started

### Prerequisites

- Bun >= 1.1 (`curl -fsSL https://bun.sh/install | bash`)
- Node.js >= 20 (for `tsx` scripts — Bun uses Node for some scripts)

### Install

```bash
cd /Users/morgangreff/workspace/bit-brand-anarchy-portal
bun install
```

### Database Setup

```bash
# 1. Generate migrations from schema (only needed after schema changes)
bun run db:generate

# 2. Apply migrations
bun run db:migrate

# 3. Seed demo data
bun run db:seed
```

The SQLite file is created at `./data/portal.db`. The `data/` directory is auto-created by `src/lib/db/index.ts` if it doesn't exist.

### Dev Server

```bash
bun run dev
# Runs on http://localhost:3000
```

### Test Credentials (from seed)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bitbrandanarchy.com` | `admin123!` |
| Client | `client@acmecorp.com` | `client123!` |

### Where to Go First

| URL | What you'll see |
|---|---|
| `http://localhost:3000/` | Redirects to `/admin/dashboard` (if admin) or `/portal` (if client) |
| `http://localhost:3000/login` | Login page |
| `http://localhost:3000/admin/dashboard` | Admin overview |
| `http://localhost:3000/portal/acme-corp/dashboard` | Demo client portal (seed data) |

---

## 4. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group — no layout applied
│   │   ├── invite/[token]/       # Invitation acceptance page
│   │   └── login/                # Login page
│   ├── admin/                    # Admin-only section (ADMIN role required by proxy.ts)
│   │   ├── layout.tsx            # Admin shell: sidebar + header
│   │   ├── error.tsx             # Admin error boundary
│   │   ├── dashboard/            # Admin dashboard (client list, stats)
│   │   ├── clients/
│   │   │   ├── page.tsx          # All clients list
│   │   │   └── [id]/             # Single client management
│   │   │       ├── page.tsx      # Client detail + data source config
│   │   │       ├── keywords/     # Admin keyword management for client
│   │   │       ├── reports/      # Admin report editor
│   │   │       │   └── [reportId]/  # Single report editor
│   │   │       └── strategy/     # Admin strategy editor
│   │   │           └── [strategyId]/
│   │   └── settings/             # Admin settings (password, export)
│   ├── api/                      # API routes (all server-side)
│   │   ├── auth/
│   │   │   ├── [...nextauth]/    # NextAuth handler
│   │   │   ├── accept-invite/    # POST: accepts invitation token
│   │   │   ├── google/           # GET: initiates Google OAuth
│   │   │   └── google-sheets/    # POST: exchanges OAuth code for Sheets token
│   │   ├── clients/              # GET/POST clients; GET/PATCH/DELETE client by id
│   │   │   └── [id]/
│   │   │       ├── route.ts      # Client CRUD
│   │   │       └── data-sources/ # GET/POST/PATCH data source config
│   │   ├── export/
│   │   │   ├── csv/              # GET: CSV export for keywords/metrics
│   │   │   └── sheets/           # POST: Google Sheets export
│   │   ├── invitations/          # POST: create invite; GET: list pending
│   │   ├── keywords/             # GET/POST keywords; PATCH/DELETE by id; POST import
│   │   ├── reports/              # GET/POST reports; GET/PATCH/DELETE by id; POST refresh
│   │   │   └── [id]/refresh/     # POST: re-pulls auto-data for report
│   │   ├── settings/
│   │   │   ├── export/           # GET: full data export
│   │   │   └── password/         # POST: change admin password
│   │   ├── strategies/           # GET/POST strategies; GET/PATCH/DELETE by id
│   │   └── sync/
│   │       ├── [clientId]/       # POST: sync all sources for client
│   │       └── [clientId]/[source]/  # POST: sync single source (GA4|GSC|AHREFS|RANKSCALE|SEMRUSH)
│   ├── portal/                   # Client-facing portal
│   │   ├── page.tsx              # Redirects CLIENT to their portal slug
│   │   └── [clientSlug]/         # Scoped to a single client
│   │       ├── layout.tsx        # Portal shell: sidebar + header + impersonation banner
│   │       ├── error.tsx         # Portal error boundary
│   │       ├── dashboard/        # KPI cards, traffic chart, top keywords
│   │       ├── keywords/         # Keyword research table (client view)
│   │       ├── strategy/         # SEO strategy (published only)
│   │       │   └── [strategyId]/
│   │       ├── reports/          # Monthly reports list + individual report view
│   │       │   └── [reportId]/
│   │       └── ai-visibility/    # AI visibility trend + prompt results
│   ├── globals.css               # Global styles + CSS custom properties
│   ├── layout.tsx                # Root layout (html, body, theme provider)
│   └── page.tsx                  # Root: redirects based on auth state
│
├── components/
│   ├── admin/                    # Admin-specific components ("use client" where needed)
│   │   ├── admin-header.tsx
│   │   ├── admin-keyword-table.tsx
│   │   ├── admin-report-actions.tsx  # Publish/archive report buttons
│   │   ├── admin-sidebar.tsx
│   │   ├── admin-strategy-actions.tsx
│   │   ├── change-password-form.tsx
│   │   ├── client-edit-form.tsx
│   │   ├── client-status-badge.tsx
│   │   ├── create-client-dialog.tsx
│   │   ├── data-source-form.tsx      # Per-source credential input
│   │   ├── invite-user-dialog.tsx
│   │   ├── keyword-form-dialog.tsx
│   │   ├── report-editor.tsx         # Rich-text report section editor
│   │   ├── strategy-editor.tsx       # Rich-text strategy section editor
│   │   └── sync-controls.tsx         # Sync trigger buttons + status
│   ├── auth/
│   │   ├── login-form.tsx            # "use client" login form
│   │   └── accept-invite-form.tsx    # "use client" invite acceptance
│   ├── portal/                   # Portal-specific components
│   │   ├── ai-visibility-card.tsx
│   │   ├── ai-visibility-trend-chart.tsx  # Recharts line chart
│   │   ├── dashboard-skeleton.tsx
│   │   ├── empty-state.tsx
│   │   ├── export-buttons.tsx         # PDF/CSV/Sheets export triggers
│   │   ├── impersonation-banner.tsx   # Yellow admin-impersonation banner
│   │   ├── keyword-table.tsx          # Sortable/filterable keyword table
│   │   ├── kpi-card.tsx               # Metric card with trend indicator
│   │   ├── portal-header.tsx
│   │   ├── portal-sidebar.tsx
│   │   ├── prompt-results-table.tsx   # Rankscale prompt results
│   │   ├── report-traffic-chart.tsx
│   │   ├── search-performance-chart.tsx
│   │   ├── sheets-export-dialog.tsx   # Google Sheets OAuth dialog
│   │   ├── top-keywords-table.tsx
│   │   └── traffic-chart.tsx
│   └── ui/                       # shadcn/ui primitives
│       ├── alert.tsx, avatar.tsx, badge.tsx, button.tsx
│       ├── card.tsx, data-table.tsx, dialog.tsx
│       ├── dropdown-menu.tsx, input.tsx, label.tsx
│       ├── separator.tsx, sheet.tsx, sidebar.tsx
│       ├── skeleton.tsx, sonner.tsx, tooltip.tsx
│
├── hooks/
│   └── use-mobile.ts             # Media query hook for responsive behaviour
│
├── lib/
│   ├── auth/
│   │   ├── config.ts             # Edge-safe auth config (no Node.js imports)
│   │   ├── index.ts              # Full auth with DB + bcrypt (server only)
│   │   ├── invites.ts            # Invitation token generation + validation
│   │   └── types.ts              # NextAuth session type augmentation
│   ├── db/
│   │   ├── index.ts              # better-sqlite3 connection + Drizzle instance
│   │   ├── schema.ts             # All table definitions + type exports
│   │   ├── migrate.ts            # Migration runner script
│   │   └── seed.ts               # Demo data seeder
│   ├── email/
│   │   └── index.ts              # sendInviteEmail + sendReportPublishedEmail
│   ├── export/
│   │   ├── csv.ts                # CSV string generators + browser download
│   │   └── pdf.ts                # jsPDF report + keyword PDF generators (browser only)
│   ├── integrations/
│   │   ├── types.ts              # SyncResult, CredentialsApiKey, date helpers
│   │   ├── ga4.ts                # Google Analytics 4 sync
│   │   ├── gsc.ts                # Google Search Console sync
│   │   ├── ahrefs.ts             # Ahrefs sync
│   │   ├── rankscale.ts          # Rankscale AI visibility sync + aggregate helper
│   │   └── semrush.ts            # SEMrush AI visibility sync
│   ├── reports/
│   │   └── auto-data.ts          # getReportAutoData() — DB aggregation for report sections
│   ├── theme.config.ts           # Brand name, colors — update when assets arrive
│   └── utils.ts                  # cn() (clsx + tailwind-merge)
│
└── proxy.ts                      # Next.js middleware (Edge Runtime — no Node.js APIs)
```

### Key Files to Know

| File | Why it matters |
|---|---|
| `src/proxy.ts` | ALL route protection lives here. Runs on Edge Runtime. |
| `src/lib/auth/config.ts` | Edge-safe — used in proxy.ts |
| `src/lib/auth/index.ts` | Full auth — used in server components and API routes |
| `src/lib/db/schema.ts` | Single source of truth for all DB tables and types |
| `src/lib/integrations/rankscale.ts` | Also contains `updateAiVisibilityAggregate()` used by SEMrush sync |
| `src/lib/export/pdf.ts` | **Browser only** — never import server-side |
| `src/app/portal/[clientSlug]/layout.tsx` | Enforces client-to-portal access control |

---

## 5. Database

### Engine

SQLite via `better-sqlite3`. File location: `./data/portal.db` (relative to project root).

WAL mode and foreign keys are enabled in `src/lib/db/index.ts`.

### All Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | All users (admin + client) | `id`, `email`, `name`, `passwordHash`, `role` (ADMIN\|CLIENT), `avatarUrl` |
| `clients` | Client organisations | `id`, `name`, `domain`, `slug` (unique URL key), `isActive`, `createdBy` |
| `client_users` | Many-to-many: users ↔ clients | `clientId`, `userId` — unique pair |
| `invitations` | Pending client invites | `email`, `clientId`, `token` (UUID), `expiresAt`, `acceptedAt` |
| `api_credentials` | Agency-level encrypted API keys | `provider` (GA4\|GSC\|MOZ\|DATAFORSEO\|RANKSCALE), `credentialsEnc` (AES-256-GCM encrypted), `isActive`, `lastTestedAt` |
| `sync_jobs` | Sync job tracking | `clientId`, `source`, `status` (PENDING\|RUNNING\|SUCCESS\|FAILED\|FAILED_PERMANENT), `startedAt`, `completedAt`, `rowsInserted`, `error`, `triggeredBy` (MANUAL\|SCHEDULER\|API), `retryCount` |
| `data_sources` | Per-client integration config | `clientId`, `type` (GA4\|GSC\|MOZ\|DATAFORSEO\|RANKSCALE), `propertyIdentifier`, `isConnected`, `lastSyncedAt`, `lastSyncError` |
| `ga4_metrics` | Daily GA4 traffic data | `clientId`, `date` (YYYY-MM-DD), `sessions`, `users`, `newUsers`, `pageviews`, `bounceRate`, `avgSessionDuration`, `organicSessions` |
| `gsc_metrics` | GSC search query data | `clientId`, `date`, `query`, `page`, `clicks`, `impressions`, `ctr`, `position` |
| `moz_metrics` | Moz domain metrics | `clientId`, `date`, `domainAuthority`, `pageAuthority`, `spamScore`, `brandAuthority`, `backlinks`, `referringDomains`, `organicKeywords`, `organicTraffic` |
| `rankscale_metrics` | AI visibility per prompt | `clientId`, `date`, `prompt`, `platform` (ChatGPT\|Perplexity\|Gemini), `isVisible`, `position`, `responseSnippet`, `visibilityScore` |
| `keyword_research` | Client keyword list | `clientId`, `keyword`, `monthlyVolume`, `difficulty`, `intent`, `priority`, `currentPosition`, `targetPosition`, `status`, `lastEnrichedAt` |
| `seo_strategies` | Strategy documents | `clientId`, `title`, `sections` (JSON array of `{id, title, content, order}`), `status` (DRAFT\|PUBLISHED\|ARCHIVED) |
| `monthly_reports` | Monthly SEO reports | `clientId`, `month` (1-12), `year`, `sections` (JSON with section keys each containing `adminNotes` + `autoData`), `status`, unique per `(clientId, month, year)` |
| `ai_visibility` | Aggregated AI visibility scores | `clientId`, `date`, `overallScore`, `rankscaleScore`, `secondaryScore`, `totalPromptsTested`, `promptsVisible` |

**Unique constraints to be aware of:**
- `api_credentials`: one record per `provider`
- `data_sources`: one record per `(clientId, type)` pair
- `ga4_metrics`: one record per `(clientId, date)`
- `moz_metrics`: one record per `(clientId, date)`
- `monthly_reports`: one record per `(clientId, month, year)`
- `ai_visibility`: one record per `(clientId, date)`

### Running Migrations

```bash
# After changing schema.ts — generate a new migration SQL file
bun run db:generate

# Apply all pending migrations
bun run db:migrate
```

Migrations are output to `./drizzle/migrations/`.

The migration runner is `src/lib/db/migrate.ts` (run via `tsx`).

### Drizzle Studio

```bash
bun run db:studio
# Opens the Drizzle Studio UI at https://local.drizzle.studio
```

### Resetting the Database

```bash
# Delete the DB file and reseed from scratch
rm ./data/portal.db
bun run db:migrate
bun run db:seed
```

---

## 6. Authentication & Roles

### Two Roles

| Role | Access |
|---|---|
| `ADMIN` | All of `/admin/*`, can impersonate any client portal at `/portal/[clientSlug]/*` |
| `CLIENT` | Only `/portal/[clientSlug]/*` for their own client slug |

### How Auth Works

**NextAuth v5 beta**, JWT session strategy, Credentials provider (email + password).

1. User submits login form → `POST /api/auth/signin` (handled by NextAuth)
2. `src/lib/auth/index.ts` `authorize()` runs: looks up user in DB, verifies bcrypt hash
3. For CLIENT users, `authorize()` also fetches `clientId` from `client_users` table
4. JWT token is issued containing `{ id, email, name, role, clientId }`
5. On subsequent requests, `session()` callback exposes these fields via `auth()`

**Session shape** (TypeScript — augmented in `src/lib/auth/types.ts`):

```typescript
session.user = {
  id: string;           // UUID from users table
  email: string;
  name: string;
  role: "ADMIN" | "CLIENT";
  clientId?: string;    // Only set for CLIENT role
}
```

### The Edge-Safe Split: `config.ts` vs `index.ts`

This is the most critical architectural decision in the auth system. Read carefully.

**`src/lib/auth/config.ts`** — Edge-safe config:
- Contains ONLY JWT/session callbacks and the `authorized()` callback
- Has **zero Node.js imports** — no `db`, no `fs`, no `path`, no `bcryptjs`
- Used by `src/proxy.ts` which runs on the Edge Runtime
- Cannot access the database — only reads the JWT token already in the request

**`src/lib/auth/index.ts`** — Full auth:
- Extends `authConfig` with the Credentials provider
- Imports `db`, `bcryptjs`, `users`, `clientUsers` from the DB layer
- **Only import this in:** server components, API routes, server actions
- **Never import this in:** `src/proxy.ts` or any file imported by it

**Rule:** If a file is imported (directly or transitively) by `src/proxy.ts`, it must not import anything from `src/lib/auth/index.ts` or `src/lib/db`.

```typescript
// In server components, API routes, server actions:
import { auth } from "@/lib/auth"; // uses index.ts

// In proxy.ts:
import { authConfig } from "@/lib/auth/config"; // edge-safe
```

### Route Protection via `src/proxy.ts`

The middleware intercepts every request (except `api/`, `_next/static`, `_next/image`, `favicon.ico`) and:

1. Allows `/login` and `/invite` without auth
2. Redirects unauthenticated requests to `/login`
3. Redirects non-ADMIN users away from `/admin/*`
4. Redirects root `/` to the appropriate dashboard based on role

The portal-level access check (CLIENT can only see their own slug) is enforced in `src/app/portal/[clientSlug]/layout.tsx` via a DB query — this cannot be done in the middleware because it requires a DB call.

### Impersonation

Admins can view any client portal. When an admin navigates to `/portal/[clientSlug]/dashboard`, the `PortalClientLayout` detects `role === "ADMIN"` and skips the membership check. The `ImpersonationBanner` component is always rendered — it checks for `?impersonate=true` in the URL to decide whether to display itself.

To enter impersonation mode: from the admin client detail page, click "View as Client" — this navigates to `/portal/[clientSlug]/dashboard?impersonate=true`.

---

## 7. Route Map

All routes are dynamic (Server-side rendered). `○` = static, `ƒ` = dynamic.

### Auth Routes

| Route | Description |
|---|---|
| `GET /login` | Login page (`src/app/(auth)/login/page.tsx`) |
| `GET /invite/[token]` | Invitation acceptance page — validates token, shows set-password form |
| `POST /api/auth/[...nextauth]` | NextAuth handler (sign-in, sign-out, session) |
| `POST /api/auth/accept-invite` | Validates invite token, creates user account, marks invite accepted |
| `GET /api/auth/google` | Initiates Google OAuth flow (for GA4/GSC) |
| `POST /api/auth/google-sheets` | Exchanges OAuth authorization code for Google Sheets access token |

### Admin Routes

| Route | Description |
|---|---|
| `GET /admin/dashboard` | Admin overview: all clients, recent activity |
| `GET /admin/clients` | All clients list with status badges |
| `GET /admin/clients/[id]` | Client detail: info, data sources, sync status, invite user |
| `GET /admin/clients/[id]/keywords` | Keyword management for client |
| `GET /admin/clients/[id]/reports` | Reports list for client |
| `GET /admin/clients/[id]/reports/[reportId]` | Report editor: sections, publish/archive |
| `GET /admin/clients/[id]/strategy` | Strategy list for client |
| `GET /admin/clients/[id]/strategy/[strategyId]` | Strategy editor: sections, publish/archive |
| `GET /admin/settings` | Admin settings: change password, data export |

### Portal Routes (Client-facing)

| Route | Description |
|---|---|
| `GET /portal` | Redirects CLIENT to their slug; ADMIN to admin dashboard |
| `GET /portal/[clientSlug]/dashboard` | KPI cards, traffic chart, top keywords, AI score |
| `GET /portal/[clientSlug]/keywords` | Sortable/filterable keyword research table |
| `GET /portal/[clientSlug]/strategy` | Published SEO strategy list |
| `GET /portal/[clientSlug]/strategy/[strategyId]` | Strategy document view |
| `GET /portal/[clientSlug]/reports` | Published monthly reports list |
| `GET /portal/[clientSlug]/reports/[reportId]` | Full report view with export buttons |
| `GET /portal/[clientSlug]/ai-visibility` | AI visibility trend chart + prompt results table |

### API Routes

| Route | Method | Description |
|---|---|---|
| `/api/clients` | GET, POST | List clients; create new client |
| `/api/clients/[id]` | GET, PATCH, DELETE | Get/update/delete client |
| `/api/clients/[id]/data-sources` | GET, POST, PATCH | Manage data source config for client |
| `/api/keywords` | GET, POST | List keywords (by clientId query param); create keyword |
| `/api/keywords/[id]` | PATCH, DELETE | Update/delete keyword |
| `/api/keywords/import` | POST | Bulk import keywords (CSV/JSON) |
| `/api/invitations` | GET, POST | List pending invites; create and send invite |
| `/api/reports` | GET, POST | List reports; create report |
| `/api/reports/[id]` | GET, PATCH, DELETE | Get/update/delete report |
| `/api/reports/[id]/refresh` | POST | Re-pull auto-data from DB for report sections |
| `/api/strategies` | GET, POST | List strategies; create strategy |
| `/api/strategies/[id]` | GET, PATCH, DELETE | Get/update/delete strategy |
| `/api/sync/[clientId]` | POST | Trigger sync for all connected sources |
| `/api/sync/[clientId]/[source]` | POST | Trigger sync for one source (GA4\|GSC\|AHREFS\|RANKSCALE\|SEMRUSH) |
| `/api/export/csv` | GET | CSV export — query params: `type` (keywords\|ga4\|gsc), `clientId` |
| `/api/export/sheets` | POST | Google Sheets export — body: `{ accessToken, data, sheetTitle }` |
| `/api/settings/password` | POST | Change admin password |
| `/api/settings/export` | GET | Full data export (JSON) |

---

## 8. Admin Features

### Dashboard (`/admin/dashboard`)

Overview of all clients with:
- Active/inactive count
- Last sync timestamps
- Quick links to each client portal

### Client Management (`/admin/clients`)

- **Create client:** `CreateClientDialog` — name, domain, slug, industry, notes. Slug must be URL-safe (used in `/portal/[clientSlug]`).
- **Edit client:** `ClientEditForm` — all fields including `isActive` toggle
- **Client detail (`/admin/clients/[id]`):** Shows data source connection status, sync controls, keyword count, report count

### Data Source Connections

Each client can have up to 5 data sources (one per type). Configured via `DataSourceForm`:

| Source | Auth method | Fields |
|---|---|---|
| GA4 | OAuth access token | Property ID, Access Token (manual for POC) |
| GSC | OAuth access token | Site URL, Access Token (manual for POC) |
| Ahrefs | API key | API Key (stored in `credentialsEnc` as JSON) |
| Rankscale | API key | API Key (stored in `credentialsEnc` as JSON) |
| SEMrush | API key + project ID | API Key + Project ID (stored in `credentialsEnc` as JSON) |

Credentials are stored in `dataSources.credentialsEnc` as a plain JSON string. **TODO: encrypt before production.**

### Sync Controls

`SyncControls` component (`src/components/admin/sync-controls.tsx`) shows:
- Last sync time per source
- Last sync error (if any)
- "Sync Now" button per source → `POST /api/sync/[clientId]/[source]`
- "Sync All" button → `POST /api/sync/[clientId]`

Syncs are manual only — no scheduler. The API route calls the appropriate integration function and returns a `SyncResult`.

### Invite Flow

1. Admin opens `InviteUserDialog`, enters client user's email
2. `POST /api/invitations` creates an `invitations` record with a UUID token, sets `expiresAt` to 7 days out, calls `sendInviteEmail()`
3. In POC mode (no `RESEND_API_KEY`): invite URL is logged to the console
4. User clicks invite link → `/invite/[token]` → `AcceptInviteForm`
5. `POST /api/auth/accept-invite` validates token, creates user with hashed password, inserts `client_users` row, marks `acceptedAt`

### Impersonation

From the admin client detail page, click "View as Client" to navigate to `/portal/[clientSlug]/dashboard?impersonate=true`. The `ImpersonationBanner` shows a yellow sticky banner at the top of the portal. Click "Exit" to return to the admin panel.

### Settings (`/admin/settings`)

- Change admin password (`ChangePasswordForm` → `POST /api/settings/password`)
- Full data export: download all client data as JSON (`GET /api/settings/export`)

---

## 9. Client Portal Features

All portal routes are at `/portal/[clientSlug]/`. Access is enforced in the layout.

### Dashboard (`/portal/[clientSlug]/dashboard`)

- **KPI cards:** Organic sessions, total clicks, domain rating, AI visibility score — each with a trend percentage vs. prior period
- **Traffic chart:** Daily sessions + organic sessions (Recharts `AreaChart` or `LineChart`)
- **Top keywords table:** Top 10 GSC queries by clicks for the current/recent month

### Keyword Research (`/portal/[clientSlug]/keywords`)

`KeywordTable` component — client view, read-only:
- Columns: Keyword, Volume, Difficulty, Intent, Priority, Current Position, Target Position, Status
- Sortable by any column
- Filterable by status and priority
- Export buttons: PDF (`generateKeywordsPDF()`) and CSV (`GET /api/export/csv?type=keywords&clientId=...`)

### SEO Strategy (`/portal/[clientSlug]/strategy`)

- Lists all PUBLISHED strategies for the client (DRAFT and ARCHIVED are hidden)
- Each strategy has ordered sections with rich-text HTML content authored by the admin
- Read-only for clients — no editing capability

### Monthly Reports (`/portal/[clientSlug]/reports`)

- Lists all PUBLISHED monthly reports
- Each report (`/portal/[clientSlug]/reports/[reportId]`) shows:
  - Predefined sections: Executive Summary, Traffic Overview, Keyword Rankings, Backlink Profile, AI Visibility, Wins, Opportunities, Next Month Goals
  - Each section contains `adminNotes` (rich text from the editor) and `autoData` (pulled from integration tables by `getReportAutoData()`)
  - Export buttons: PDF (`generateReportPDF()`), CSV (`GET /api/export/csv`), Google Sheets (`POST /api/export/sheets`)

### AI Search Visibility (`/portal/[clientSlug]/ai-visibility`)

- **Overall score card:** Combined score from Rankscale + SEMrush (0-100)
- **Trend chart:** Line chart of `aiVisibility.overallScore` over the last 6 months (`AiVisibilityTrendChart`)
- **Prompt results table:** Per-platform breakdown from `rankscaleMetrics` — shows each tested prompt, whether the brand was visible, position, response snippet, and visibility score

---

## 10. Data Integrations

All integration files live in `src/lib/integrations/`. Each exports a `sync*Data(clientId)` function that returns a `SyncResult`.

### `SyncResult` Type

```typescript
interface SyncResult {
  success: boolean;
  rowsInserted: number;
  error?: string;
  source: string;  // "GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE"
}
```

### GA4 (`src/lib/integrations/ga4.ts`)

- **API:** Google Analytics Data API v1 — `POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport`
- **Auth:** OAuth 2.0 access token from agency-level `apiCredentials` table
- **Fetches:** sessions, totalUsers, newUsers, screenPageViews, bounceRate, averageSessionDuration, organicGoogleSearchSessions — grouped by date, for the last 90 days
- **Stores:** Upserts into `ga4_metrics` table (unique per `clientId + date`)
- **Date format gotcha:** GA4 API returns dates as `YYYYMMDD` — the sync function converts to `YYYY-MM-DD`

### GSC (`src/lib/integrations/gsc.ts`)

- **API:** Google Webmaster Tools API v3 — `POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query`
- **Auth:** OAuth 2.0 access token from agency-level `apiCredentials` table
- **Fetches:** Dimensions `[date, query]`, last 90 days, row limit 1000
- **Stores:** Inserts into `gsc_metrics` (non-unique index, uses `onConflictDoNothing`)
- **siteUrl format:** Must match exactly what's registered in GSC (e.g. `https://www.example.com/` with trailing slash or `sc-domain:example.com`)

### Moz (`src/lib/integrations/moz.ts`)

- **Auth:** API key from agency-level `apiCredentials` table (encrypted)
- **Fetches:** Domain Authority, Page Authority, Spam Score, Brand Authority, backlinks, referring domains, organic keywords, organic traffic
- **Stores:** Upserts into `moz_metrics` (unique per `clientId + date`)

### DataForSEO (`src/lib/integrations/dataforseo.ts`)

- **Auth:** API credentials from agency-level `apiCredentials` table (encrypted)
- **Fetches:** Keyword volume, difficulty, SERP positions
- **Stores:** Enriches `keyword_research` table with volume/difficulty data, updates `lastEnrichedAt` timestamp

### Rankscale (`src/lib/integrations/rankscale.ts`)

- **Auth:** API key from agency-level `apiCredentials` table (encrypted)
- **Fetches:** AI visibility per prompt across platforms (ChatGPT, Perplexity, Gemini)
- **Stores:** Inserts into `rankscale_metrics`, then calls `updateAiVisibilityAggregate()` to update `ai_visibility` table
- **⚠ PLACEHOLDER ENDPOINT:** `https://api.rankscale.io/v1/visibility?apiKey=...&domain=...` is a best-guess based on the product. Confirm the actual endpoint with Rankscale documentation before deploying
- **Aggregate helper:** `updateAiVisibilityAggregate(clientId, date)` in this file updates the combined AI visibility score

### Triggering a Sync

**Via Admin UI:** Admin client detail page → Sync Controls section → "Sync Now" or "Sync All" buttons

**Via API:**
```bash
# Sync all sources for a client
curl -X POST /api/sync/{clientId}

# Sync a single source
curl -X POST /api/sync/{clientId}/GA4
curl -X POST /api/sync/{clientId}/GSC
curl -X POST /api/sync/{clientId}/MOZ
curl -X POST /api/sync/{clientId}/DATAFORSEO
curl -X POST /api/sync/{clientId}/RANKSCALE
```

The sync API routes call the appropriate integration function and return the `SyncResult` as JSON.

---

## 11. Export System

### PDF Export (client-side)

**File:** `src/lib/export/pdf.ts`

**Important:** This file uses `jsPDF` which requires browser APIs (`document`, `Blob`, `URL.createObjectURL`). It is dynamically imported inside client components only — never import it at the top of a server component or API route.

Two export functions:

**`generateReportPDF(report: ReportData)`** — A4 portrait PDF with:
- Dark header with agency name and client/month
- Section 1: Executive Summary (if present)
- Section 2: Traffic Overview (4-column metric grid)
- Section 3: Search Performance (3-column metric grid)
- Section 4: Top Keywords (autotable — up to 10 rows)
- Section 5: Backlink Profile (4-column metric grid)
- Section 6: AI Search Visibility (large score display)
- Sections 7-9: Wins, Opportunities, Next Month Goals (if present)
- Footer on every page with generation date and page number
- Filename: `BBA_Report_{ClientName}_{Month}.pdf`

**`generateKeywordsPDF(keywords: KeywordData[], clientName: string)`** — A4 landscape PDF with:
- Header with agency name and client name
- Full keywords table (all columns)
- Footer on every page
- Filename: `BBA_Keywords_{ClientName}_{Date}.pdf`

**Where the button is:** `src/components/portal/export-buttons.tsx` — renders in the report view and keywords view pages.

### CSV Export (server-side)

**File:** `src/lib/export/csv.ts`

Contains both browser-side (`downloadCSV()`) and server-side (`keywordsToCSV()`, `metricsToCSV()`) functions.

**API route:** `GET /api/export/csv`

Query params:
- `type`: `keywords` | `ga4` | `gsc`
- `clientId`: the client UUID

Returns `Content-Type: text/csv` with UTF-8 BOM (for Excel compatibility).

The `downloadCSV()` function is browser-only — creates a Blob and triggers a download link click.

### Google Sheets Export

**Flow:**
1. Client clicks "Export to Google Sheets" → `SheetsExportDialog` opens
2. Dialog prompts for a Google OAuth access token with Sheets scope
3. User pastes a token obtained from Google OAuth Playground (POC approach)
4. `POST /api/export/sheets` is called with `{ accessToken, data, sheetTitle }`
5. API route uses the Sheets API to create a new spreadsheet and populate it

**For POC testing:** Get a token at `https://developers.google.com/oauthplayground` with scope `https://www.googleapis.com/auth/spreadsheets`.

**For production:** Implement full Google OAuth flow using `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The `/api/auth/google` and `/api/auth/google-sheets` routes are stubs for this.

---

## 12. Branding / Theme System

### `src/lib/theme.config.ts`

The central brand config. Update this when BIT Brand Anarchy brand assets arrive:

```typescript
export const themeConfig = {
  brand: {
    name: "BIT Brand Anarchy",   // Full brand name — appears in PDF headers, emails
    shortName: "BBA",            // Abbreviated name
    tagline: "SEO Intelligence Portal",
  },
  colors: {
    // HSL values matching Tailwind CSS variable format
    primary: "222.2 47.4% 11.2%",          // Replace with brand primary color
    primaryForeground: "210 40% 98%",
    accent: "210 40% 96.1%",
    accentForeground: "222.2 47.4% 11.2%",
  },
} as const;
```

### CSS Variables (`src/app/globals.css`)

Tailwind v4 uses CSS custom properties. The theme colors from `themeConfig` should map to CSS variables defined in `globals.css` under `:root` and `.dark`. Variables follow the shadcn/ui naming convention:
- `--primary`, `--primary-foreground`
- `--accent`, `--accent-foreground`
- `--background`, `--foreground`
- `--muted`, `--muted-foreground`
- etc.

### What "theme-ready" means

- Change `themeConfig.colors` values → rebuilds CSS variables
- Swap logo: update `themeConfig.brand.logoUrl` if added, or replace logo component directly
- PDF headers hardcode `"BIT Brand Anarchy"` — update `src/lib/export/pdf.ts` lines 123 and 247 when brand name changes
- Email templates hardcode the brand name — update `src/lib/email/index.ts`

---

## 13. Email

### File: `src/lib/email/index.ts`

**POC mode (no `RESEND_API_KEY`):** Emails are logged to the server console instead of sent. Check terminal output for the invite URL during testing.

**Production mode (with `RESEND_API_KEY`):** Emails are sent via the Resend API (`https://api.resend.com/emails`).

### Events That Trigger Emails

| Event | Function | When called |
|---|---|---|
| Client user invited | `sendInviteEmail()` | `POST /api/invitations` |
| Monthly report published | `sendReportPublishedEmail()` | When report status changes to PUBLISHED |

### Environment Variables for Email

```bash
RESEND_API_KEY=re_xxxxx         # Required for sending; if blank, console output mode
RESEND_FROM=BIT Brand Anarchy <noreply@bitbrandanarchy.com>  # Optional override
```

### Adding a New Email Type

1. Add a new `interface *EmailParams` to `src/lib/email/index.ts`
2. Export a new `send*Email()` function following the existing pattern
3. Add the POC console output fallback (check `!process.env.RESEND_API_KEY`)
4. Call the function from the appropriate API route or server action

---

## 14. Environment Variables

File: `.env.local` (at project root — never commit this file)

Copy from `.env.example` and fill in required values.

| Variable | Required | What it does |
|---|---|---|
| `AUTH_SECRET` | **Yes** | NextAuth JWT signing secret. Generate with `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **Yes** | 32-byte encryption key for API credentials. Generate with `openssl rand -hex 32` (must be 64 hex chars) |
| `CRON_SECRET` | Production | Secret for authenticating scheduled sync jobs. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | **Yes** | Base URL for NextAuth callbacks. `http://localhost:3000` for dev |
| `DATABASE_URL` | **Yes** | Path to SQLite file. `./data/portal.db` |
| `RESEND_API_KEY` | Optional | Resend API key for sending real emails. Blank = console output mode |
| `RESEND_FROM` | Optional | From address for emails. Defaults to `BIT Brand Anarchy <noreply@bitbrandanarchy.com>` |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID for GA4/GSC OAuth flow |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |

**⚠️ CRITICAL:** The `ENCRYPTION_KEY` is required to encrypt/decrypt API credentials stored in the `apiCredentials` table. Without it, the application will throw an error on startup. If lost, all stored credentials become unrecoverable.

**API keys for integrations (GA4, GSC, Moz, DataForSEO, Rankscale) are stored agency-wide in the `apiCredentials` table (encrypted) — not in environment variables.**

### Current `.env.local`

```bash
# Auth (REQUIRED)
AUTH_SECRET=<generated secret>
NEXTAUTH_URL=http://localhost:3000

# Database (REQUIRED)
DATABASE_URL=./data/portal.db

# Credential Encryption (REQUIRED)
ENCRYPTION_KEY=<64-character-hex-string>

# Scheduled Jobs (REQUIRED for production)
CRON_SECRET=<generated secret>

# Email (Optional — blank = console output mode)
RESEND_API_KEY=

# Google OAuth (Optional — not yet implemented)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Generating Required Secrets

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY (must be exactly 64 hex characters)
openssl rand -hex 32

# Generate CRON_SECRET
openssl rand -base64 32
```

---

## 15. Adding a New Client (Step-by-Step)

This is the complete admin workflow to onboard a real client from zero.

### Step 1: Create the Client Record

1. Log in as admin → `/admin/dashboard`
2. Click "New Client"
3. Fill in:
   - **Name:** e.g. `Acme Corp`
   - **Domain:** e.g. `acmecorp.com` (no protocol, no trailing slash)
   - **Slug:** e.g. `acme-corp` (URL-safe, lowercase, hyphens — becomes `/portal/acme-corp/`)
   - **Industry:** optional
   - **Notes:** optional (internal only)
4. Save → client record created in `clients` table

### Step 2: Connect Data Sources

Navigate to `/admin/clients/[id]` → Data Sources section.

For each source you want to connect:

**Note:** Agency-level API credentials are stored in the `apiCredentials` table (encrypted). Per-client configuration (property IDs, site URLs) is stored in `dataSources`.

**GA4:**
- Property Identifier: find in GA4 admin → Property Settings (format: `properties/123456789`)
- Toggle "Connected" → Save

**GSC:**
- Property Identifier: exact URL as registered in Search Console (e.g. `https://acmecorp.com/`)
- Toggle "Connected" → Save

**Moz:**
- Property Identifier: domain to track (e.g. `acmecorp.com`)
- Toggle "Connected" → Save

**DataForSEO:**
- Property Identifier: domain to track (e.g. `acmecorp.com`)
- Toggle "Connected" → Save

**Rankscale:**
- Property Identifier: domain to track (e.g. `acmecorp.com`)
- Toggle "Connected" → Save

### Step 3: Trigger Initial Sync

On the client detail page, click "Sync All" to pull data from all connected sources. Check the sync status panel for errors. Each successful sync populates the relevant metrics tables.

### Step 4: Add Keyword Research

Navigate to `/admin/clients/[id]/keywords`. Add keywords manually via the form dialog, or bulk-import via CSV (`POST /api/keywords/import`).

Fields: keyword, monthly volume, difficulty, intent, priority, current position, target position, target URL, status, notes.

### Step 5: Create and Publish SEO Strategy

Navigate to `/admin/clients/[id]/strategy` → "New Strategy".

- Add a title (e.g. "Q2 2025 SEO Strategy")
- Add sections: each section has a title and rich-text HTML content
- Sections are stored as a JSON array: `[{ id, title, content, order }]`
- Change status from DRAFT → PUBLISHED to make visible to client

### Step 6: Invite the Client User

On the client detail page → "Invite User" button.

- Enter the client's email address
- `POST /api/invitations` creates the invite and calls `sendInviteEmail()`
- In POC mode: check terminal for the invite URL (format: `/invite/[token]`)
- In production: email is sent via Resend

Client clicks the link → sets their password → account is created → they can log in.

### Step 7: Create and Publish First Report

Navigate to `/admin/clients/[id]/reports` → "New Report".

- Select month and year
- Click "Refresh Data" to pull auto-data from integration tables into the report sections
- Fill in `adminNotes` for each section (Executive Summary, Wins, Opportunities, Next Month Goals)
- Change status from DRAFT → PUBLISHED
- This triggers `sendReportPublishedEmail()` to the client (if `RESEND_API_KEY` is set)

Client can now view the report at `/portal/[clientSlug]/reports/[reportId]` and export as PDF, CSV, or Google Sheets.

---

## 16. Adding a New Feature (Agent Instructions)

### How to Add a New Portal Page

1. Create the page file at `src/app/portal/[clientSlug]/your-page/page.tsx`
2. It is a server component by default — fetch data with `db` queries at the top
3. Await params: `const { clientSlug } = await params;`
4. Add the nav link to `src/components/portal/portal-sidebar.tsx`
5. If the page needs charts or interactive components, create them in `src/components/portal/` with `"use client"` at the top, pass server-fetched data as props

```typescript
// src/app/portal/[clientSlug]/your-page/page.tsx
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function YourPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { clientSlug } = await params;

  // Fetch your data here
  const data = await db.select()...;

  return <YourClientComponent data={data} />;
}
```

### How to Add a New API Route

1. Create `src/app/api/your-route/route.ts`
2. Export named functions: `GET`, `POST`, `PATCH`, `DELETE`
3. Import `auth` from `@/lib/auth` and check session at the top of each handler
4. Return `NextResponse.json(...)` with appropriate status codes

```typescript
// src/app/api/your-route/route.ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await db.select()...;
  return NextResponse.json(data);
}
```

### How to Add a New DB Table

1. Add the table definition to `src/lib/db/schema.ts` following existing patterns
2. Export the inferred types at the bottom of schema.ts
3. Generate a migration:
   ```bash
   bun run db:generate
   ```
4. Apply the migration:
   ```bash
   bun run db:migrate
   ```
5. Import the new table in your integration/service files as needed

```typescript
// In schema.ts
export const myNewTable = sqliteTable("my_new_table", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  // ... columns
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type MyNewTable = typeof myNewTable.$inferSelect;
export type NewMyNewTable = typeof myNewTable.$inferInsert;
```

### How to Add a New Data Integration

1. Create `src/lib/integrations/your-source.ts`
2. Import `db`, `dataSources`, and your metrics table from schema
3. Implement `syncYourSourceData(clientId: string): Promise<SyncResult>`
4. Follow the existing pattern:
   - Fetch the `dataSources` record for this client + type
   - Check `isConnected` and credentials
   - Call the external API
   - Upsert results into the metrics table
   - Update `dataSources.lastSyncedAt` on success or `lastSyncError` on failure
   - Return a `SyncResult`
5. Add `"YOUR_SOURCE"` to the `type` enum in `dataSources` table in `schema.ts`
6. Run `db:generate` and `db:migrate`
7. Add the new source to the sync API route (`src/app/api/sync/[clientId]/[source]/route.ts`)
8. Add the UI form to `DataSourceForm` in `src/components/admin/data-source-form.tsx`

### Critical Rules

**Always await params in dynamic routes:**
```typescript
// Every dynamic page and layout
const { clientSlug } = await params;
```

**Never use Node.js APIs in `src/proxy.ts` or files it imports:**
```typescript
// proxy.ts runs on Edge Runtime
// NO: import { db } from "@/lib/db"     — uses better-sqlite3 (Node.js)
// NO: import { auth } from "@/lib/auth" — uses bcryptjs (Node.js)
// YES: import { authConfig } from "@/lib/auth/config" — pure JS, no Node.js
```

**Never import `src/lib/export/pdf.ts` in server-side code:**
The file uses `jsPDF` which depends on browser APIs. Only import it inside `"use client"` components via dynamic import:
```typescript
// Inside a "use client" component
const { generateReportPDF } = await import("@/lib/export/pdf");
```

**`"use client"` placement:** Add `"use client"` at the very top of any component that uses React hooks (`useState`, `useEffect`, `useRouter`, etc.), event handlers, or browser APIs. Do not add it to server components — they fetch data from the DB.

**Type-safe DB queries:** Always use Drizzle's typed query builder. Never write raw SQL strings. Use `eq()`, `and()`, `or()`, `gte()`, `lte()`, etc. from `drizzle-orm`.

**Don't mutate session data.** The session is read-only. To change a user's role or clientId, update the DB and force a new sign-in.

---

## 17. Known TODOs / Limitations

| Area | Status | Detail |
|---|---|---|
| **Google OAuth (GA4/GSC)** | Stub only | `/api/auth/google` and `/api/auth/google-sheets` routes exist but the full OAuth flow is not wired up. For POC: manually paste access tokens obtained from [OAuth Playground](https://developers.google.com/oauthplayground) into the data source form. Needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and a proper OAuth callback implementation. |
| **Rankscale API endpoint** | Placeholder | `https://api.rankscale.io/v1/visibility` is a best-guess. Confirm the actual endpoint, auth method, and response schema with Rankscale before activating. |
| **SEMrush AI visibility endpoint** | Placeholder | `https://api.semrush.com/reports/v1/projects/{projectId}/ai-overview` is unverified. SEMrush AI visibility may require a paid add-on. Verify endpoint and required plan with SEMrush API docs. |
| **Email (Resend)** | POC mode | Set `RESEND_API_KEY` in `.env.local` to send real emails. POC mode logs to console. Also need to verify the sender domain in Resend. |
| **Google Sheets OAuth** | Manual token | `SheetsExportDialog` prompts users to paste an OAuth token manually (obtained from OAuth Playground). Needs the full Google OAuth flow for production. |
| **Sync scheduler** | Not implemented | All syncs are manually triggered via the admin UI or API. No cron job or webhook-based scheduler exists. For production, add a scheduled job (Vercel Cron, external cron, etc.) to call `/api/sync/[clientId]`. |
| **Credential encryption** | ✅ Implemented | Agency-level credentials in `apiCredentials.credentialsEnc` are encrypted using AES-256-GCM with `ENCRYPTION_KEY` environment variable. The encryption key is required on startup. |
| **OAuth token refresh** | Not implemented | OAuth token refresh logic is not implemented. GA4/GSC tokens expire in 1 hour — for production, implement automatic token refresh using the stored refresh token in `apiCredentials`. |
| **SQLite → PostgreSQL** | Not done | The current driver is `better-sqlite3`. To migrate to PostgreSQL for production: replace driver with `pg` or `postgres.js`, update `drizzle.config.ts` dialect to `postgresql`, update `src/lib/db/index.ts` to use the new driver, and run `db:generate` to regenerate migrations for Postgres. Schema itself (Drizzle types) requires minimal changes. |
| **Keyword bulk import** | Stub | `POST /api/keywords/import` route exists but import logic needs implementation (CSV parsing, validation, bulk insert). |
| **Rich-text editor** | Basic | The strategy and report editors use `contenteditable` or a basic textarea for rich text. For production, consider integrating TipTap or Quill for proper rich-text editing. |
| **No automated testing** | Not set up | No test suite exists. Before production, add unit tests for integration functions and API routes, and E2E tests for critical flows (login, invite, report export). |

---

## 18. Common Commands Reference

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
sqlite3 ./data/portal.db "SELECT type, isConnected, lastSyncedAt, lastSyncError FROM data_sources;"
sqlite3 ./data/portal.db "SELECT COUNT(*) FROM ga4_metrics;"
```

### Resetting the Database

```bash
# Full reset: delete DB, re-migrate, re-seed
rm ./data/portal.db && bun run db:migrate && bun run db:seed
```

### Generating a New `AUTH_SECRET`

```bash
openssl rand -base64 32
# Paste output into .env.local as AUTH_SECRET
```

### Checking the Build Route List

```bash
bun run build 2>&1 | grep -E "^[├└]"
```

### Running a One-Off DB Script

```bash
# Use tsx to run a TypeScript script that imports from src/lib/db
npx tsx ./your-script.ts
# Or via bun
bun ./your-script.ts
```
