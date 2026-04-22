# BIT Brand Anarchy SEO Client Portal

White-label SEO portal for agency teams and client users.

This repo contains:

- an **admin workspace** for onboarding clients, managing SEO workstreams, and running sync/operations
- a **client portal** at `/portal/[clientSlug]` for dashboards, reports, approvals, notifications, and related collaboration views

> Current state: active development with Phase 1–3 expansions merged. Feature flags are effectively always-on (see [`docs/feature-policy.md`](./docs/feature-policy.md)).

## Quick Start

### 1) Prerequisites

- Bun >= 1.1
- Node.js >= 20 (used by `tsx` scripts)

### 2) Install

```bash
bun install
```

### 3) Configure environment

```bash
cp .env.example .env.local
```

Required minimum values:

- `AUTH_SECRET`
- `DATABASE_URL` (default `./data/portal.db`)
- `ENCRYPTION_KEY` (64 hex chars)
- `NEXTAUTH_URL`

If you use the default dev script (`bun run dev`), Next runs on **http://localhost:6969**. Set `NEXTAUTH_URL` to match.

### 4) Prepare database

```bash
bun run db:migrate
bun run db:seed
```

### 5) Start app

```bash
bun run dev
```

## Demo Credentials (seed data)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bitbrandanarchy.com` | `admin123!` |
| Client | `client@acmecorp.com` | `client123!` |

## Common Commands

```bash
# App
bun run dev
bun run build
bun run start

# Quality
bun run lint
bun run test
bun run test:coverage

# DB
bun run db:generate
bun run db:migrate
bun run db:seed
bun run db:studio

# Utility
bun run validate
```

## Architecture at a Glance

- **Framework:** Next.js 16 App Router + React 19
- **Auth:** NextAuth v5 credentials, JWT sessions, Edge-safe proxy split (`auth/config.ts` vs `auth/index.ts`)
- **DB:** Drizzle ORM + SQLite (`better-sqlite3`)
- **Core domains:** onboarding, dashboard, AI visibility, prompt research, technical audits, content, links, approvals, implementation queue, tasks/notifications/messages, reports/strategy/keywords
- **Integrations:** GA4, GSC, Moz, DataForSEO, Rankscale
- **Exports:** PDF (client-only), CSV, Google Sheets
- **Cron:** `/api/cron/weekly-sync` scheduled in `vercel.json`; additional cron endpoints are available and secret-protected

See full details in [`docs/architecture.md`](./docs/architecture.md).

## Important Gotchas

- Next.js 16 middleware file is **`src/proxy.ts`** (not `middleware.ts`).
- Dynamic route `params` are promises and must be awaited.
- Do not import browser-only PDF utilities in server code.
- `src/proxy.ts` runs on Edge runtime: keep imports edge-safe.

## Documentation Map

- System overview: [`docs/architecture.md`](./docs/architecture.md)
- Contributor workflow: [`docs/development-workflow.md`](./docs/development-workflow.md)
- Feature flag policy: [`docs/feature-policy.md`](./docs/feature-policy.md)
- Extended project handbook: [`AGENTS.md`](./AGENTS.md)

## License

Proprietary — internal BIT Brand Anarchy use.
