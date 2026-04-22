# Architecture Overview

This document summarizes the **current architecture** after Phase 1–3 expansions.
It is intended for engineers who need a practical mental model before changing code.

## 1) System Shape

The app is a Next.js 16 monolith with clear internal layers:

1. **Presentation layer**
   - App Router pages/layouts in `src/app/**`
   - Client components in `src/components/**`
2. **API boundary layer**
   - Route handlers in `src/app/api/**/route.ts`
   - AuthN/AuthZ, request parsing, response envelopes
3. **Domain/service layer**
   - Business logic in `src/lib/**` by domain (AI, onboarding, technical, content, links, etc.)
4. **Data layer**
   - Drizzle schema in `src/lib/db/schema.ts`
   - SQLite access through `src/lib/db/index.ts`
5. **External integration layer**
   - Third-party data sync adapters in `src/lib/integrations/**`

## 2) App Layers in Practice

### UI and route composition

- Admin app lives under `/admin/**`
- Client portal lives under `/portal/[clientSlug]/**`
- Shared auth routes live under `/(auth)`
- API routes are colocated under `/api/**`

### Domain modules (phase-expanded)

Current code includes domain modules for:

- onboarding
- dashboard aggregates/filters
- AI context/visibility/prompt research/lens recommendation
- technical audits and prioritization
- content audits/briefs/calendar/assets
- links (backlinks/prospects/outreach)
- approvals and revision requests
- implementation queue + provider adapters
- tasks, notifications, messaging
- reports, strategy, keywords, exports

## 3) Authentication and Authorization Model

### Authentication

- NextAuth v5 credentials provider (`src/lib/auth/index.ts`)
- JWT session strategy
- Login validates credentials against `users` and `client_users`

### Edge-safe split (critical)

- `src/lib/auth/config.ts` is edge-safe and used by `src/proxy.ts`
- `src/lib/auth/index.ts` is full server auth and may import DB/bcrypt

Never import server-only auth/DB modules into files used by `src/proxy.ts`.

### Authorization

- Permission checks are centralized with `can(...)` and policy helpers in `src/lib/auth/authorize.ts`
- The codebase supports legacy role mapping (`ADMIN`, `CLIENT`) and expanded role vocabulary (`AGENCY_OWNER`, `ACCOUNT_MANAGER`, etc.)
- Client-scoped actions validate client access context (`getClientAccessContext`)

## 4) Data Model and Storage

- Primary datastore: SQLite (`better-sqlite3`) with Drizzle ORM
- Single schema source: `src/lib/db/schema.ts`
- Migrations generated/applied with drizzle-kit + `tsx` scripts

The schema now includes foundational portal entities plus phase-expanded entities (onboarding, technical/content/link workflows, approvals, implementation executions, tasks/notifications, AI visibility/prompt research, etc.).

## 5) Data Flows

### A) Client data sync flow (metrics integrations)

1. Admin triggers `/api/sync/[clientId]` or `/api/sync/[clientId]/[source]`
2. API validates access and source
3. Integration adapter runs (`ga4`, `gsc`, `moz`, `dataforseo`, `rankscale`)
4. `sync_jobs` records status/result
5. Downstream pages read normalized tables for dashboards/reports

### B) AI visibility run flow

1. Prompt sets/prompts are configured in AI visibility tables
2. Runs are created via API or cron endpoint
3. Execution services process engines and persist run results
4. Aggregate/score tables are updated and read in portal/admin views

### C) Workflow and execution flow (phase expansions)

1. Technical/content/link signals generate proposals/findings
2. Approval pathways gate execution decisions
3. Implementation queue tracks proposal → execution → rollback/snapshot timeline
4. Tasks/notifications/messages support operational follow-through

## 6) Integrations

Current adapters exist for:

- Google Analytics 4
- Google Search Console
- Moz
- DataForSEO
- Rankscale

Credentials are managed via API credential/data source records and encrypted credential storage patterns (`ENCRYPTION_KEY`).

## 7) Export Architecture

- **PDF**: `src/lib/export/pdf.ts` (browser-only, dynamically imported in client components)
- **CSV**: server route + utility (`/api/export/csv`, `src/lib/export/csv.ts`)
- **Google Sheets**: `/api/export/sheets`

Rule of thumb: server components/routes should not import browser-only export helpers.

## 8) Cron and Scheduling

### Scheduled in deployment config

- `vercel.json` currently schedules `POST /api/cron/weekly-sync`.

### Additional cron endpoints in code

- `/api/cron/ai-visibility-runs`
- `/api/cron/tasks-alerts`

All cron endpoints use `Authorization: Bearer <CRON_SECRET>` checks.

### Local dev scheduler

- `bun run dev:scheduler` runs `scripts/dev-scheduler.ts`
- Triggers weekly sync endpoint on an interval for local testing

## 9) Testing Strategy (Current)

- Test runner: Vitest (`tests/**/*.test.ts`)
- Environment: node, with global test setup/mocks in `tests/setup.ts`
- Focus: API behavior, service logic, permission paths, regressions
- Tests are largely mock-driven for deterministic execution

Feature-flag-off tests remain present but intentionally skipped (see `docs/feature-policy.md`).

## 10) Known Architectural Constraints

- Next.js 16 conventions apply (`proxy.ts`, async route params)
- SQLite is local and synchronous; operational scale assumptions should reflect that
- Some external integration endpoints/plans are placeholders until vendor confirmation
- Full production hardening (infrastructure and E2E depth) is still an active concern

## Verification with Axon

```bash
# Core auth and policy paths
axon_context "authConfig"
axon_context "can"

# Sync and cron entry points
axon_context "syncGA4Data"
axon_query "api/cron"

# Schema impact exploration
axon_impact "syncJobs"
axon_impact "implementationProposals"
```
