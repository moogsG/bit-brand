# Development Workflow

This guide describes the expected contributor workflow for this repository.

## 1) Local Setup

### Prerequisites

- Bun >= 1.1
- Node.js >= 20

### Install dependencies

```bash
bun install
```

### Environment

```bash
cp .env.example .env.local
```

Set required values:

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `ENCRYPTION_KEY`

If using `bun run dev` (configured as `PORT=6969 next dev`), set:

```bash
NEXTAUTH_URL=http://localhost:6969
```

### Database bootstrap

```bash
bun run db:migrate
bun run db:seed
```

## 2) Day-to-Day Development Loop

1. Pull latest main branch.
2. Create a feature/fix branch.
3. Implement changes in small, reviewable commits.
4. Run quality checks locally.
5. Update docs for behavior or policy changes.

Recommended local run commands:

```bash
bun run dev
bun run test:watch
```

## 3) Database and Migrations

When schema changes:

```bash
bun run db:generate
bun run db:migrate
```

Optional inspection:

```bash
bun run db:studio
```

Reset local DB if needed:

```bash
rm ./data/portal.db
bun run db:migrate
bun run db:seed
```

## 4) Quality Gates and Commands

Run before opening a PR:

```bash
bun run lint
bun run build
bun run test
```

Optional:

```bash
bun run test:coverage
bun run validate
```

Notes:

- `bun run check` exists but currently shells through `npm run ...` internally.
- In this repo, Bun-first command usage is preferred for day-to-day execution.

## 5) Next.js / Runtime Gotchas

### Next.js 16 specifics

- Middleware file is `src/proxy.ts`.
- Dynamic route `params` must be awaited.

### Edge runtime boundary

`src/proxy.ts` and transitive imports must stay edge-safe:

- Do **not** import DB modules (`better-sqlite3`)
- Do **not** import full auth module (`@/lib/auth`)
- Use `@/lib/auth/config` in proxy context

### Client vs server boundaries

- Keep charts/forms/dialog interactivity in `"use client"` components.
- Keep DB reads/writes in server components or API routes.
- `src/lib/export/pdf.ts` is browser-only.

## 6) Testing Guidance

- Tests live in `tests/**/*.test.ts` (Vitest)
- Keep tests deterministic via mocks at boundaries
- For new APIs/services, add tests covering:
  - auth/authz behavior
  - validation and error paths
  - primary success path

Feature flag “disabled path” tests are intentionally skipped for historical compatibility. See `docs/feature-policy.md`.

## 7) Definition of Done (DoD)

A change is done when all are true:

- [ ] Scope implemented and manually verified in UI/API as applicable
- [ ] Schema migration included (if schema changed)
- [ ] `bun run lint`, `bun run build`, `bun run test` pass locally
- [ ] New/updated tests cover changed behavior
- [ ] No edge-runtime or client/server boundary violations introduced
- [ ] Docs updated (README and/or docs/*) when behavior/policy changed
- [ ] Security-sensitive changes reviewed (authz, secrets, external inputs)

## 8) Optional Local Scheduler Loop

For cron behavior testing:

```bash
bun run dev:scheduler
```

This script calls `/api/cron/weekly-sync` on an interval using `CRON_SECRET`.

## Verification with Axon

```bash
# Confirm route entry points
axon_query "src/app/api"

# Inspect impacted symbols before/after changes
axon_context "can"
axon_impact "getPhase3Flag"
```
