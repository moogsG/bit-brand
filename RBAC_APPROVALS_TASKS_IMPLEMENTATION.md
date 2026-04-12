# RBAC + Approvals + Tasks/Kanban Implementation

**Development Slice 1 - Foundation**

## Overview

This implementation adds Role-Based Access Control (RBAC), approval workflows, and task/kanban management to the BIT Brand SEO OS portal. The foundation is designed to be minimal, compilable, and ready for extension in future slices.

---

## Database Schema Changes

### New Tables

#### 1. `roles`
- **Purpose:** Define system and custom roles with permissions
- **Key columns:**
  - `name` (unique) - e.g., "MARKETING_LEAD", "SEO_SPECIALIST"
  - `permissions` (JSON array) - permission strings
  - `isSystem` (boolean) - true for built-in roles
- **Indexes:** Unique on `name`

#### 2. `role_assignments`
- **Purpose:** Assign roles to users with optional client scope
- **Key columns:**
  - `userId` → `users.id`
  - `roleId` → `roles.id`
  - `clientId` → `clients.id` (nullable - null = global scope)
  - `assignedBy` → `users.id`
- **Indexes:** Unique on `(userId, roleId, clientId)`

#### 3. `approval_policies`
- **Purpose:** Define approval requirements for actions
- **Key columns:**
  - `name` (unique) - e.g., "report_publish"
  - `resourceType` - "REPORT", "STRATEGY", etc.
  - `action` - "PUBLISH", "ARCHIVE", etc.
  - `requiredRoles` (JSON array) - role names that can approve
  - `isActive` (boolean)
- **Indexes:** Unique on `name`

#### 4. `approvals`
- **Purpose:** Track approval requests and their status
- **Key columns:**
  - `policyId` → `approval_policies.id`
  - `resourceType`, `resourceId` - what's being approved
  - `clientId` → `clients.id`
  - `requestedBy` → `users.id`
  - `status` - "PENDING", "APPROVED", "REJECTED", "CANCELLED"
  - `approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt`, `rejectionReason`
  - `metadata` (JSON) - additional context
- **Indexes:** 
  - `status`
  - `(resourceType, resourceId)`
  - `clientId`

#### 5. `revision_requests`
- **Purpose:** Request changes to pending approvals
- **Key columns:**
  - `approvalId` → `approvals.id`
  - `requestedBy` → `users.id`
  - `reason`, `suggestions`
  - `status` - "OPEN", "ADDRESSED", "DISMISSED"
  - `addressedBy`, `addressedAt`

#### 6. `audit_logs`
- **Purpose:** Append-only audit trail
- **Key columns:**
  - `userId` → `users.id` (nullable for system actions)
  - `action` - "CREATE", "UPDATE", "DELETE", "APPROVE", etc.
  - `resourceType`, `resourceId`
  - `clientId` → `clients.id`
  - `changes` (JSON) - snapshot of changes
  - `ipAddress`, `userAgent`
- **Indexes:**
  - `userId`
  - `(resourceType, resourceId)`
  - `clientId`
  - `createdAt`

#### 7. `tasks`
- **Purpose:** Task management for client work
- **Key columns:**
  - `clientId` → `clients.id`
  - `title`, `description`
  - `status` - "TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"
  - `priority` - "LOW", "MEDIUM", "HIGH", "URGENT"
  - `assignedTo` → `users.id`
  - `createdBy` → `users.id`
  - `dueDate`, `completedAt`
  - `kanbanColumnId` → `kanban_columns.id`
  - `position` - for ordering within column
  - `tags` (JSON array)
  - `linkedResourceType`, `linkedResourceId` - link to reports/strategies
- **Indexes:**
  - `clientId`
  - `assignedTo`
  - `status`
  - `(kanbanColumnId, position)`

#### 8. `kanban_columns`
- **Purpose:** Customizable kanban board columns per client
- **Key columns:**
  - `clientId` → `clients.id`
  - `name`, `position`, `color`
  - `isDefault` (boolean)
- **Indexes:** `(clientId, position)`

---

## API Routes

### Approvals

#### `GET /api/approvals`
- **Query params:** `status`, `clientId`, `resourceType`
- **Returns:** List of approvals
- **Auth:** Any authenticated user

#### `POST /api/approvals`
- **Body:** `{ policyName, resourceType, resourceId, clientId, metadata }`
- **Returns:** Created approval
- **Auth:** Any authenticated user
- **Side effects:** Creates audit log entry

#### `GET /api/approvals/[id]`
- **Returns:** Single approval
- **Auth:** Any authenticated user

#### `PATCH /api/approvals/[id]`
- **Body:** `{ action: "approve" | "reject" | "cancel", reason? }`
- **Returns:** Updated approval
- **Auth:** 
  - "approve"/"reject": User must have required role (from policy) or be ADMIN
  - "cancel": Only the requester can cancel
- **Side effects:** Creates audit log entry

### Tasks

#### `GET /api/tasks`
- **Query params:** `clientId` (required), `assignedTo`, `status`
- **Returns:** List of tasks
- **Auth:** Any authenticated user

#### `POST /api/tasks`
- **Body:** `{ clientId, title, description?, status?, priority?, assignedTo?, dueDate?, kanbanColumnId?, position?, tags?, linkedResourceType?, linkedResourceId? }`
- **Returns:** Created task
- **Auth:** ADMIN only
- **Side effects:** Creates audit log entry

#### `GET /api/tasks/[id]`
- **Returns:** Single task
- **Auth:** Any authenticated user

#### `PATCH /api/tasks/[id]`
- **Body:** Any task fields to update
- **Returns:** Updated task
- **Auth:** ADMIN only
- **Side effects:** 
  - Auto-sets `completedAt` when status changes to "DONE"
  - Clears `completedAt` when status changes from "DONE"
  - Creates audit log entry

#### `DELETE /api/tasks/[id]`
- **Returns:** `{ success: true }`
- **Auth:** ADMIN only
- **Side effects:** Creates audit log entry

### Kanban Columns

#### `GET /api/kanban-columns`
- **Query params:** `clientId` (required)
- **Returns:** List of columns ordered by position
- **Auth:** Any authenticated user

#### `POST /api/kanban-columns`
- **Body:** `{ clientId, name, position?, color?, isDefault? }`
- **Returns:** Created column
- **Auth:** ADMIN only
- **Side effects:** Creates audit log entry

#### `PATCH /api/kanban-columns/[id]`
- **Body:** `{ name?, position?, color?, isDefault? }`
- **Returns:** Updated column
- **Auth:** ADMIN only
- **Side effects:** Creates audit log entry

#### `DELETE /api/kanban-columns/[id]`
- **Returns:** `{ success: true }`
- **Auth:** ADMIN only
- **Side effects:** Creates audit log entry

---

## UI Components

### Admin Dashboard (`/admin/dashboard`)

**New sections:**
1. **Pending Approvals Card** (`PendingApprovalsCard`)
   - Shows all pending approvals across all clients
   - Quick approve/reject buttons (placeholder - no action wired yet)
   - Badge showing count

2. **My Tasks Card** (`MyTasksCard`)
   - Shows tasks assigned to the current admin user
   - Filters out DONE and BLOCKED tasks
   - Shows top 5 by creation date
   - Priority badges with color coding
   - Due date display

### Client Detail Page (`/admin/clients/[id]`)

**New tabs:**
1. **Tasks Tab**
   - Kanban board view (`KanbanBoard` component)
   - Horizontal scrollable columns
   - Task cards with priority indicators (colored dots)
   - Status badges
   - Due date display
   - "Add task" and "Add column" buttons (placeholder - no action wired yet)

2. **Approvals Tab**
   - Approval history table (`ClientApprovalsList` component)
   - Shows all approvals for the client
   - Status badges with color coding
   - Requested and resolved dates

---

## Approval Workflow Integration

### Report Publishing Gate

**File:** `src/app/api/reports/[id]/route.ts`

**Behavior:**
1. When `PATCH /api/reports/[id]` is called with `status: "PUBLISHED"`:
   - Check if `report_publish` policy exists and is active
   - If approval required:
     - Check current approval status for this report
     - If no approval or rejected: Create approval request, return 202 with `requiresApproval: true`
     - If pending: Return 400 error "Approval pending"
     - If approved: Proceed with publishing
   - If no approval required: Publish directly

**Audit trail:**
- All approval requests are logged to `audit_logs`
- Action: "REQUEST_APPROVAL"

---

## Seeded Data

### Default Roles
1. **MARKETING_LEAD**
   - Permissions: `approve_reports`, `approve_strategies`, `manage_tasks`
   - System role

2. **SEO_SPECIALIST**
   - Permissions: `create_reports`, `create_strategies`, `manage_keywords`
   - System role

3. **CONTENT_WRITER**
   - Permissions: `create_drafts`, `view_reports`
   - System role

### Default Approval Policies
1. **report_publish**
   - Resource: REPORT
   - Action: PUBLISH
   - Required roles: MARKETING_LEAD, ADMIN
   - Active: true

2. **strategy_publish**
   - Resource: STRATEGY
   - Action: PUBLISH
   - Required roles: MARKETING_LEAD, ADMIN
   - Active: true

### Default Kanban Columns (per client)
1. Backlog (gray, default)
2. To Do (blue)
3. In Progress (yellow)
4. Review (purple)
5. Done (green)

---

## Helper Functions

### `src/lib/approvals/index.ts`

**Exported functions:**

1. `requiresApproval(resourceType, action): Promise<boolean>`
   - Check if an approval policy exists and is active

2. `createApprovalRequest(params): Promise<string>`
   - Create an approval request
   - Returns approval ID

3. `canApprove(approvalId, userId, userRole): Promise<boolean>`
   - Check if a user can approve a specific request
   - Admins always can
   - Otherwise checks role assignments

4. `hasPendingApproval(resourceType, resourceId): Promise<boolean>`
   - Check if a pending approval exists for a resource

5. `getApprovalStatus(resourceType, resourceId): Promise<"APPROVED" | "PENDING" | "REJECTED" | "NONE">`
   - Get the current approval status for a resource

---

## Edge Runtime Compliance

**No Node.js imports in `src/proxy.ts`:**
- All new tables and logic are server-side only
- No changes to middleware/proxy layer
- All API routes run in Node.js runtime (default)

---

## Migration Steps

1. **Generate migration:**
   ```bash
   bun run db:generate
   ```

2. **Apply migration:**
   ```bash
   bun run db:migrate
   ```

3. **Seed default data:**
   ```bash
   bun run db:seed
   ```

---

## Testing the Implementation

### 1. Test Approval Workflow

```bash
# Create an approval request
curl -X POST http://localhost:3000/api/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "policyName": "report_publish",
    "resourceType": "REPORT",
    "resourceId": "report-id-here",
    "clientId": "client-id-here",
    "metadata": { "title": "January 2025 Report" }
  }'

# List pending approvals
curl http://localhost:3000/api/approvals?status=PENDING

# Approve (requires MARKETING_LEAD role or ADMIN)
curl -X PATCH http://localhost:3000/api/approvals/[approval-id] \
  -H "Content-Type: application/json" \
  -d '{ "action": "approve" }'
```

### 2. Test Task Management

```bash
# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-id-here",
    "title": "Optimize homepage meta tags",
    "description": "Update title and description for better CTR",
    "priority": "HIGH",
    "status": "TODO"
  }'

# List tasks for a client
curl http://localhost:3000/api/tasks?clientId=client-id-here

# Update task status
curl -X PATCH http://localhost:3000/api/tasks/[task-id] \
  -H "Content-Type: application/json" \
  -d '{ "status": "IN_PROGRESS" }'
```

### 3. Test Report Publishing with Approval Gate

```bash
# Try to publish a report (will create approval request)
curl -X PATCH http://localhost:3000/api/reports/[report-id] \
  -H "Content-Type: application/json" \
  -d '{ "status": "PUBLISHED" }'

# Expected response (202):
# {
#   "message": "Approval request created",
#   "approvalId": "...",
#   "requiresApproval": true
# }
```

---

## Known Limitations & TODOs

### Current Slice (Foundation)
- ✅ Database schema complete
- ✅ API routes functional
- ✅ Basic UI components rendered
- ✅ Approval gate enforced on report publishing
- ✅ Audit logging in place
- ⚠️ UI actions are placeholders (approve/reject buttons don't call API yet)
- ⚠️ No real-time updates (requires manual refresh)
- ⚠️ No role assignment UI (must be done via DB or API)
- ⚠️ No task drag-and-drop (kanban is read-only)

### Next Slices (Not Implemented)
1. **Sales Audit Trail**
   - Extend `audit_logs` with sales-specific events
   - Sales pipeline tracking
   - Client acquisition funnel

2. **Off-Page SEO Tracking**
   - Backlink monitoring
   - Citation tracking
   - Social signals
   - Brand mentions

3. **Scoring System**
   - SEO health score calculation
   - Competitive benchmarking
   - Progress tracking over time
   - Automated recommendations

4. **Notifications**
   - Email notifications for approvals
   - In-app notification center
   - Slack/Teams integration

5. **Advanced Task Features**
   - Drag-and-drop kanban
   - Task dependencies
   - Time tracking
   - Recurring tasks
   - Task templates

6. **Role Management UI**
   - Create/edit custom roles
   - Assign roles to users
   - Permission matrix view

---

## Files Changed

### Schema
- `src/lib/db/schema.ts` - Added 8 new tables + type exports

### API Routes (New)
- `src/app/api/approvals/route.ts` - GET, POST
- `src/app/api/approvals/[id]/route.ts` - GET, PATCH
- `src/app/api/tasks/route.ts` - GET, POST
- `src/app/api/tasks/[id]/route.ts` - GET, PATCH, DELETE
- `src/app/api/kanban-columns/route.ts` - GET, POST
- `src/app/api/kanban-columns/[id]/route.ts` - PATCH, DELETE

### API Routes (Modified)
- `src/app/api/reports/[id]/route.ts` - Added approval gate logic

### Components (New)
- `src/components/admin/pending-approvals-card.tsx` - Dashboard widget
- `src/components/admin/my-tasks-card.tsx` - Dashboard widget
- `src/components/admin/kanban-board.tsx` - Kanban view
- `src/components/admin/client-approvals-list.tsx` - Approval history table

### Pages (Modified)
- `src/app/admin/dashboard/page.tsx` - Added approvals & tasks cards
- `src/app/admin/clients/[id]/page.tsx` - Added tasks & approvals tabs

### Utilities (New)
- `src/lib/approvals/index.ts` - Approval workflow helpers

### Seed
- `src/lib/db/seed.ts` - Added RBAC & kanban seeding

---

## Summary

This implementation provides a solid foundation for RBAC, approval workflows, and task management. The code is compilable, follows existing patterns, and is ready for extension. The approval gate is functional and enforced on report publishing. The UI is minimal but complete enough to demonstrate the features.

**Next steps:**
1. Wire up UI actions (approve/reject buttons, task creation dialogs)
2. Add role assignment UI
3. Implement drag-and-drop for kanban
4. Add notification system
5. Extend to sales audit and off-page tracking
6. Build scoring system

**Estimated effort for next slice:** 8-12 hours (UI interactivity + notifications)
