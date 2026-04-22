# Alchem Phase 3 Execution Backlog

**Scope:** Content, Links, Collaboration

**Source plan:** `docs/alchem-full-implementation-plan.md`

**Goal:** Ship a full content lifecycle (audit → calendar → briefs/drafts → approvals/versioning), link intelligence (monitoring + prospecting + outreach), and client collaboration loops (approvals + notifications), plus approval-gated technical execution scaffolding.

---

## 0) Phase 2 Gates (Prerequisites)

Phase 3 depends on Phase 2 foundations:

- **Phase 2 / EPIC-08 / Story 8.3** — AI interaction audit trail (metadata-only)
- **Phase 2 / EPIC-09 / Stories 9.1–9.3** — EEAT scoring v1 (factor model + recommendations + read endpoint)

---

## 1) Phase 3 Outcomes

By the end of Phase 3, the platform must support:

1. **Content audit recommendations** that are deterministic and action-oriented (refresh/consolidate/delete/retarget)
2. A **content calendar + workflow** with ownership, due dates, and approval states
3. **Content briefs + version history** (revision notes + approvals)
4. **EEAT questionnaires** tied to content type and captured from the client portal
5. **Backlink monitoring + link prospecting + outreach draft pipeline** (approval-gated send)
6. **Technical implementation proposals** that are approval-gated and execution-logged (WordPress-first, can be stubbed in v1)
7. **Client collaboration surfaces** (approvals queue + notifications entry points)

---

## 2) Epic Breakdown

- **EPIC-12:** Content Audit v1
- **EPIC-13:** Content Calendar + Brief Workflow
- **EPIC-14:** EEAT Questionnaires (Portal)
- **EPIC-15:** Links Intelligence (Backlinks + Prospects + Outreach)
- **EPIC-16:** Technical Implementation Agent v1 (approval-gated)
- **EPIC-17:** Client Portal v2 Collaboration (approvals + notifications)
- **EPIC-18:** Phase 3 Quality, Rollout, and Safeguards

---

## 3) Story Backlog (Prioritized)

## EPIC-12 — Content Audit v1

### Story 12.1 — Content asset inventory model + read APIs
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Persist a per-client content asset inventory (URL, type, canonical, status, timestamps, safe metadata).

**Implementation tasks**
- Add `content_assets` table + migration.
- Add read API under `/api/content/assets` (GET list by client).
- Enforce RBAC + assignment scoping.

**Acceptance criteria**
- Agency users can query content assets for assigned clients.
- Client-equivalent roles can only see client-safe fields.

---

### Story 12.2 — Deterministic content audit findings (recommendations)
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Generate deterministic “next action” findings for assets (refresh/consolidate/delete/retarget).

**Implementation tasks**
- Add `content_audit_findings` table + migration.
- Add audit engine `src/lib/content/audit.ts` (deterministic rules).
- Add endpoint `/api/content/audit` (POST recompute findings for a client).

**Acceptance criteria**
- Findings are reproducible (same inputs → same outputs).
- Findings are queryable for UI rendering.

---

## EPIC-13 — Content Calendar + Brief Workflow

### Story 13.1 — Content briefs model + CRUD
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Store briefs with workflow status, keyword targets, outline JSON, and internal notes.

**Implementation tasks**
- Add `content_briefs` table + migration.
- Add `/api/content/briefs` CRUD.
- Add approval policy integration for brief approval (use existing approvals system).

**Acceptance criteria**
- Briefs have strict agency/internal vs client-safe boundaries.
- Client roles can view approved brief summaries (and later answer EEAT questions).

---

### Story 13.2 — Version history (brief/content revisions)
**Priority:** P1  
**Estimate:** 2 days

**Requirements**
- Append-only version tracking of brief/content bodies and diffs/summaries.

**Implementation tasks**
- Add `content_versions` table + migration.
- Add `/api/content/briefs/[briefId]/versions` endpoints.

**Acceptance criteria**
- Versions are immutable and time-ordered.

---

### Story 13.3 — Content calendar items
**Priority:** P1  
**Estimate:** 2.5 days

**Requirements**
- Calendar items with due/publish dates, owner, and workflow status.

**Implementation tasks**
- Add `content_calendar_items` table + migration.
- Add `/api/content/calendar` endpoints.

**Acceptance criteria**
- Calendar is queryable by date range and status.

---

## EPIC-14 — EEAT Questionnaires (Portal)

### Story 14.1 — Questionnaire model + templates
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Store dynamic questionnaires by content type/version.

**Implementation tasks**
- Add `eeat_questionnaires` table + migration.
- Add admin endpoints to create/activate questionnaires.

**Acceptance criteria**
- Only one active questionnaire per client+contentType.

---

### Story 14.2 — Client responses capture
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Clients can submit responses tied to a brief/content.

**Implementation tasks**
- Add `eeat_responses` table + migration.
- Add `/api/eeat/responses` endpoint (POST submit, GET view).
- Portal UI for filling the questionnaire behind a Phase 3 flag.

**Acceptance criteria**
- Responses are client-scoped, auditable, and not exposed cross-client.

---

## EPIC-15 — Links Intelligence

### Story 15.1 — Backlink inventory model + read APIs
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Store backlink inventory rows (source/target/anchor, first/last seen, status).

**Implementation tasks**
- Add `backlink_inventory` table + migration.
- Add `/api/links/backlinks` GET endpoint + placeholder import/sync.

**Acceptance criteria**
- Backlinks queryable by status and date window.

---

### Story 15.2 — Prospecting model + scoring
**Priority:** P1  
**Estimate:** 3 days

**Requirements**
- Store link prospects with deterministic scoring (relevance/authority).

**Implementation tasks**
- Add `link_prospects` table + migration.
- Add `/api/links/prospects` CRUD.

**Acceptance criteria**
- Prospects are tracked by lifecycle state and show score breakdown.

---

### Story 15.3 — Outreach drafts + approval-gated send
**Priority:** P1  
**Estimate:** 3 days

**Requirements**
- Draft outreach emails; require approvals before “send”.

**Implementation tasks**
- Add `link_outreach_drafts` table + migration.
- Add endpoints to draft/update/mark approved.
- Add approvals integration for “send” action.

**Acceptance criteria**
- No outreach send occurs without explicit approval.

---

## EPIC-16 — Technical Implementation Agent v1 (Approval-gated)

### Story 16.1 — Proposal queue model + APIs
**Priority:** P0  
**Estimate:** 3 days

**Requirements**
- Store implementation proposals with change-set metadata and previews.

**Implementation tasks**
- Add `implementation_proposals` table + migration.
- Add `/api/technical/proposals` CRUD and approval integration.

**Acceptance criteria**
- Proposal changes are reviewable before execution.

---

### Story 16.2 — Execution logging + rollback snapshots (stub ok)
**Priority:** P1  
**Estimate:** 3 days

**Requirements**
- Record execution attempts and persist rollback-safe snapshots.

**Implementation tasks**
- Add `implementation_executions` + `implementation_snapshots` tables + migrations.
- Add `/api/technical/proposals/[id]/execute` endpoint that is approval-gated.

**Acceptance criteria**
- Execution is blocked unless approved.
- Logs and snapshots are queryable.

---

## EPIC-17 — Client Portal v2 Collaboration

### Story 17.1 — Approvals queue surface in portal
**Priority:** P0  
**Estimate:** 2.5 days

**Requirements**
- Client portal shows pending approvals relevant to the client.

**Implementation tasks**
- Add portal page behind `FF_PORTAL_V2` (Phase 3).
- Leverage existing approvals endpoints with client-safe filtering.

**Acceptance criteria**
- Client roles only see their own client approvals.

---

### Story 17.2 — Notifications entry point (minimal)
**Priority:** P1  
**Estimate:** 2 days

**Requirements**
- A minimal “notifications” surface for status updates (can be derived from existing audit/approvals for v1).

**Acceptance criteria**
- Notifications are client-scoped and privacy-safe.

---

## EPIC-18 — Phase 3 Quality, Rollout, and Safeguards

### Story 18.1 — Phase 3 feature flag bundle + gating
**Priority:** P0  
**Estimate:** 1 day

**Requirements**
- Flags gate all Phase 3 endpoints and UI surfaces.

**Acceptance criteria**
- Disabling flags results in 404/“not enabled” behavior without errors.

---

### Story 18.2 — Regression tests for new modules
**Priority:** P0  
**Estimate:** 2.5 days

**Requirements**
- Tests cover RBAC boundaries, client scoping, and deterministic engines.

**Acceptance criteria**
- CI green with coverage for Phase 3 entry points.
