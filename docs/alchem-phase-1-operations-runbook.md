# Alchem Phase 1 Operations + Migration Runbook

This runbook is for operating and releasing Phase 1 features:

- RBAC v2
- Onboarding v2 + North Star
- Dashboard v2
- AI context endpoints v1

All commands are copy/paste-ready for this repo.

## 1) Feature Flags and Environment

Phase 1 flags are parsed in `src/lib/flags/phase-1.ts` and default to `true`.

```bash
# Phase 1 rollout flags (default true)
FF_RBAC_V2=true
FF_ONBOARDING_V2=true
FF_DASHBOARD_V2=true
FF_AI_CONTEXT_V1=true

# AI context safe-subset switch for client-equivalent roles (default false)
AI_CONTEXT_CLIENT_SAFE_SUBSET_ENABLED=false
```

Notes:

- `FF_AI_CONTEXT_V1=false` disables both AI endpoints (`/api/ai/context/[clientId]` and `/api/ai/lens/recommend`) with `404 FEATURE_DISABLED`.
- `AI_CONTEXT_CLIENT_SAFE_SUBSET_ENABLED=false` blocks client-equivalent roles from AI context endpoints with `403 CLIENT_CONTEXT_SAFE_SUBSET_UNSUPPORTED`.
- Agency-equivalent roles can still use AI context when `FF_AI_CONTEXT_V1=true`.

## 2) RBAC v2 Operational Reference

### Roles and Compatibility

Canonical v2 roles:

- `AGENCY_OWNER`
- `ACCOUNT_MANAGER`
- `STRATEGIST`
- `CLIENT_ADMIN`
- `CLIENT_VIEWER`

Legacy compatibility is preserved during rollout:

- Agency-equivalent: `ADMIN`, `AGENCY_OWNER`, `ACCOUNT_MANAGER`, `STRATEGIST` -> maps to legacy `ADMIN`
- Client-equivalent: `CLIENT`, `CLIENT_ADMIN`, `CLIENT_VIEWER` -> maps to legacy `CLIENT`

Source of truth: `src/lib/auth/role-mapping.ts`.

### Assignment Model Operations

Assignments are managed via `src/app/api/assignments/route.ts`.

- `GET /api/assignments` (optionally `?clientId=...` and/or `?userId=...`)
- `POST /api/assignments` with `{ "userId": "...", "clientId": "..." }`
- `DELETE /api/assignments?userId=...&clientId=...`

Constraints enforced server-side:

- Only users with `ACCOUNT_MANAGER` or `STRATEGIST` can be assigned.
- Only authorized users can create/remove assignments.

### RBAC SQL Checks (Post-Migrate)

```bash
sqlite3 ./data/portal.db "SELECT role, COUNT(*) AS users FROM users GROUP BY role ORDER BY role;"
sqlite3 ./data/portal.db "SELECT COUNT(*) AS assignment_count FROM user_client_assignments;"
sqlite3 ./data/portal.db "SELECT COUNT(*) AS scoped_role_assignments FROM role_assignments WHERE client_id IS NOT NULL;"
sqlite3 ./data/portal.db "SELECT COUNT(*) AS global_role_assignments FROM role_assignments WHERE client_id IS NULL;"
```

## 3) Onboarding v2 Operational Usage

### Setup

- Enable `FF_ONBOARDING_V2=true`.
- Navigate to `/admin/clients/[id]/onboarding`.
- Onboarding API route: `src/app/api/onboarding/[clientId]/route.ts`.

### API Usage

Operations:

- `GET /api/onboarding/{clientId}`
- `PUT /api/onboarding/{clientId}` (or `PATCH`, same handler)

Status values:

- `DRAFT`
- `COMPLETED`

Operational expectation:

- Saving as draft keeps progress resumable.
- Submitting as `COMPLETED` marks the profile complete and powers North Star ribbon/dashboard context.

### Onboarding SQL Checks

```bash
sqlite3 ./data/portal.db "SELECT status, COUNT(*) AS profiles FROM client_onboarding_profiles GROUP BY status ORDER BY status;"
sqlite3 ./data/portal.db "SELECT COUNT(*) AS north_star_rows FROM onboarding_north_star_goals;"
sqlite3 ./data/portal.db "SELECT COUNT(*) AS strategic_levers_rows FROM onboarding_strategic_levers;"
```

## 4) AI Context Endpoints (Ops Notes)

Endpoints:

- `GET /api/ai/context/{clientId}`
- `POST /api/ai/lens/recommend`

Request body for recommendation endpoint:

```json
{
  "module": "dashboard",
  "clientId": "<client-uuid>",
  "question": "What is blocking this client from hitting the North Star metric?"
}
```

Supported `module` values:

- `dashboard`
- `onboarding`
- `keywords`
- `strategy`
- `reports`
- `ai-visibility`

Operational behavior:

- Endpoint envelope includes `version`, `success`, `data`, `error`.
- When client-safe subset is enabled, payload scope is `client-safe` and strips `opportunities.items`/`risks.items`.
- Placeholder recommendation endpoint logs safe metadata only and does not mutate business entities.

## 5) Migration Runbook (Phase 1)

### A. Preflight Checks

Run from repo root:

```bash
pwd
bun --version
bun install
test -f ./data/portal.db && echo "portal.db exists" || echo "portal.db missing (will be created if needed)"
```

Create rollback backup (database + WAL sidecars when present):

```bash
mkdir -p ./data/backups
STAMP="$(date +%Y%m%d-%H%M%S)"
for suffix in "" "-wal" "-shm"; do
  if [ -f "./data/portal.db${suffix}" ]; then
    cp "./data/portal.db${suffix}" "./data/backups/portal.db.${STAMP}${suffix}"
  fi
done
echo "Backup stamp: ${STAMP}"
```

### B. Migrate Commands

Use the repo scripts exactly:

```bash
bun run db:generate
bun run db:migrate
```

### C. Post-Migrate Verification

Schema-level checks:

```bash
sqlite3 ./data/portal.db ".tables"
sqlite3 ./data/portal.db "SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;"
sqlite3 ./data/portal.db "SELECT COUNT(*) AS onboarding_profiles FROM client_onboarding_profiles;"
sqlite3 ./data/portal.db "SELECT COUNT(*) AS assignments FROM user_client_assignments;"
```

App-level checks:

```bash
bunx tsc --noEmit
bun run test
bun run build
```

### D. Rollback Strategy

There is no `db:rollback` script in this repo. Rollback is backup-restore based.

#### Scenario 1: Migration command fails or schema is partially applied locally

```bash
# Stop app/test processes first
pkill -f "next dev" || true

# Restore the backup using your backup stamp
cp "./data/backups/portal.db.<STAMP>" ./data/portal.db
if [ -f "./data/backups/portal.db.<STAMP>-wal" ]; then
  cp "./data/backups/portal.db.<STAMP>-wal" ./data/portal.db-wal
fi
if [ -f "./data/backups/portal.db.<STAMP>-shm" ]; then
  cp "./data/backups/portal.db.<STAMP>-shm" ./data/portal.db-shm
fi

# Re-apply known-good state
bun run db:migrate
```

#### Scenario 2: Bad release after successful migration (feature behavior issue)

Use flag rollback first (fastest):

```bash
# Example emergency disable set
FF_RBAC_V2=false
FF_ONBOARDING_V2=false
FF_DASHBOARD_V2=false
FF_AI_CONTEXT_V1=false
```

Then redeploy with corrected code. Restore DB only if data-level corruption occurred.

#### Scenario 3: Need full rollback to pre-release code and DB snapshot

```bash
# 1) Switch repo to previously known-good commit/tag
git checkout <known-good-commit-or-tag>

# 2) Restore DB snapshot captured in preflight
cp "./data/backups/portal.db.<STAMP>" ./data/portal.db
if [ -f "./data/backups/portal.db.<STAMP>-wal" ]; then
  cp "./data/backups/portal.db.<STAMP>-wal" ./data/portal.db-wal
fi
if [ -f "./data/backups/portal.db.<STAMP>-shm" ]; then
  cp "./data/backups/portal.db.<STAMP>-shm" ./data/portal.db-shm
fi

# 3) Install + verify
bun install
bunx tsc --noEmit
bun run test
bun run build
```

## 6) Phase 1 Release Checklist

Before release:

- [ ] Backup database and record `<STAMP>`.
- [ ] Confirm `.env` has intended Phase 1 flag values.
- [ ] Confirm `AI_CONTEXT_CLIENT_SAFE_SUBSET_ENABLED` value is explicit (`true` or `false`).
- [ ] Run `bun run db:generate` and verify migration diff is expected.
- [ ] Run `bun run db:migrate`.
- [ ] Run verification suite: `bunx tsc --noEmit`, `bun run test`, `bun run build`.

After release:

- [ ] Smoke test assignment API (`/api/assignments`) with an authorized user.
- [ ] Smoke test onboarding API (`/api/onboarding/{clientId}`) and admin onboarding page.
- [ ] Smoke test AI context API (`/api/ai/context/{clientId}`) and lens recommend endpoint.
- [ ] Validate expected 403 behavior for client-equivalent roles when safe subset is disabled.
- [ ] Log release stamp, commit SHA, and rollback backup stamp in release notes.
