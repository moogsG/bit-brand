# Quick Reference Card

## 🚀 Common Commands

```bash
# Development
bun run dev                    # Start dev server
bun run dev:scheduler          # Start scheduler (separate terminal)

# Database
bun run db:migrate             # Apply migrations
bun run db:seed                # Seed demo data
bun run db:studio              # Open Drizzle Studio

# Testing
bun run test                   # Run tests once
bun run test:watch             # Run tests in watch mode
bun run test:coverage          # Run tests with coverage

# Quality Checks
bun run lint                   # Run ESLint
bun run build                  # Build for production
bun run check                  # Lint + Build + Test
bun run validate               # Validate implementation

# Production
bun run start                  # Start production server
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | Database schema (single source of truth) |
| `src/lib/db/seed.ts` | Demo data seeder |
| `src/proxy.ts` | Route protection (Edge Runtime) |
| `src/lib/auth/config.ts` | Edge-safe auth config |
| `src/lib/auth/index.ts` | Full auth (server-side only) |
| `package.json` | Scripts and dependencies |
| `AGENTS.md` | Complete project documentation |

## 🔐 Environment Variables

```bash
# Required
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=./data/portal.db
ENCRYPTION_KEY=<openssl rand -hex 32>

# Optional
RESEND_API_KEY=<resend-api-key>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
CRON_SECRET=<openssl rand -base64 32>
```

## 🧪 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bitbrandanarchy.com` | `admin123!` |
| Client | `client@acmecorp.com` | `client123!` |

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `users` | All users (admin + client) |
| `clients` | Client organizations |
| `client_users` | User-to-client mapping |
| `invitations` | Pending invites |
| `api_credentials` | Agency-level API keys (encrypted) |
| `data_sources` | Per-client integration config |
| `sync_jobs` | Sync job tracking |
| `ga4_metrics` | Google Analytics data |
| `gsc_metrics` | Search Console data |
| `moz_metrics` | Moz domain metrics |
| `rankscale_metrics` | AI visibility per prompt |
| `keyword_research` | Client keyword lists |
| `seo_strategies` | Strategy documents |
| `monthly_reports` | Monthly SEO reports |
| `ai_visibility` | Aggregated AI visibility scores |

## 🔄 Data Sources

| Source | Type | Auth Method |
|--------|------|-------------|
| GA4 | Analytics | OAuth token |
| GSC | Search Console | OAuth token |
| Moz | Domain metrics | API key |
| DataForSEO | Keyword data | API credentials |
| Rankscale | AI visibility | API key |

## 🛣️ Route Structure

```
/                              → Redirects based on role
/login                         → Login page
/invite/[token]                → Accept invitation

/admin/dashboard               → Admin overview
/admin/clients                 → All clients
/admin/clients/[id]            → Client detail
/admin/clients/[id]/keywords   → Keyword management
/admin/clients/[id]/reports    → Report management
/admin/clients/[id]/strategy   → Strategy management
/admin/settings                → Admin settings

/portal/[clientSlug]/dashboard      → Client dashboard
/portal/[clientSlug]/keywords       → Keyword research
/portal/[clientSlug]/strategy       → SEO strategy
/portal/[clientSlug]/reports        → Monthly reports
/portal/[clientSlug]/ai-visibility  → AI visibility
```

## 🔧 API Endpoints

```
# Auth
POST /api/auth/signin
POST /api/auth/signout
POST /api/auth/accept-invite

# Clients
GET    /api/clients
POST   /api/clients
GET    /api/clients/[id]
PATCH  /api/clients/[id]
DELETE /api/clients/[id]

# Data Sources
GET   /api/clients/[id]/data-sources
POST  /api/clients/[id]/data-sources
PATCH /api/clients/[id]/data-sources

# Sync
POST /api/sync/[clientId]
POST /api/sync/[clientId]/[source]

# API Credentials
GET    /api/settings/api-credentials
POST   /api/settings/api-credentials
DELETE /api/settings/api-credentials

# Keywords
GET    /api/keywords?clientId=...
POST   /api/keywords
PATCH  /api/keywords/[id]
DELETE /api/keywords/[id]

# Reports
GET    /api/reports?clientId=...
POST   /api/reports
GET    /api/reports/[id]
PATCH  /api/reports/[id]
DELETE /api/reports/[id]
POST   /api/reports/[id]/refresh

# Strategies
GET    /api/strategies?clientId=...
POST   /api/strategies
GET    /api/strategies/[id]
PATCH  /api/strategies/[id]
DELETE /api/strategies/[id]

# Export
GET  /api/export/csv?type=...&clientId=...
POST /api/export/sheets
```

## 🎨 Component Patterns

### Server Component (Default)
```typescript
// Fetch data at the top
export default async function Page({ params }) {
  const { clientSlug } = await params;
  const data = await db.select()...;
  return <ClientComponent data={data} />;
}
```

### Client Component
```typescript
"use client";

export function ClientComponent({ data }) {
  const [state, setState] = useState();
  // ... interactive logic
}
```

### API Route
```typescript
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const data = await db.select()...;
  return NextResponse.json(data);
}
```

## 🚨 Common Gotchas

### 1. Params Must Be Awaited (Next.js 16)
```typescript
// ✅ Correct
const { clientSlug } = await params;

// ❌ Wrong
const { clientSlug } = params; // Will throw!
```

### 2. Edge Runtime Restrictions
```typescript
// ❌ Don't import in proxy.ts
import { db } from "@/lib/db";        // Uses Node.js
import { auth } from "@/lib/auth";    // Uses bcryptjs

// ✅ Use edge-safe config
import { authConfig } from "@/lib/auth/config";
```

### 3. PDF Export is Browser-Only
```typescript
// ❌ Don't import server-side
import { generateReportPDF } from "@/lib/export/pdf";

// ✅ Dynamic import in client component
const { generateReportPDF } = await import("@/lib/export/pdf");
```

### 4. Session Shape
```typescript
session.user = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CLIENT";
  clientId?: string;  // Only for CLIENT role
}
```

## 📊 Testing

### Run Tests
```bash
bun run test              # Run once
bun run test:watch        # Watch mode
bun run test:coverage     # With coverage
```

### Test Files
- `tests/api-credentials.test.ts` - API credentials endpoints
- `tests/sync-jobs.test.ts` - Sync job creation

### Coverage
- 18 smoke tests total
- Mocks all external dependencies
- Fast execution (no real DB/API calls)

## 🔍 Debugging

### Check Logs
```bash
# Dev server logs
bun run dev

# Database queries (Drizzle Studio)
bun run db:studio

# Test output
bun run test
```

### Common Issues

**Build fails:**
```bash
bun run lint          # Check for linting errors
bun run build         # See full error output
```

**Tests fail:**
```bash
bun run validate      # Check implementation
bun run test          # See test output
```

**Database issues:**
```bash
rm ./data/portal.db   # Delete DB
bun run db:migrate    # Re-apply migrations
bun run db:seed       # Re-seed data
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Complete project guide |
| `TESTING.md` | Testing guide |
| `IMPLEMENTATION_SUMMARY.md` | Recent changes |
| `QUICK_REFERENCE.md` | This file |
| `tests/README.md` | Test documentation |

## 🎯 Before Committing

```bash
bun run check
```

This runs:
1. ✅ Lint (code quality)
2. ✅ Build (TypeScript/build errors)
3. ✅ Test (logic errors)

If all pass → safe to commit!

## 🚢 Deployment Checklist

- [ ] All tests pass (`bun run test`)
- [ ] Build succeeds (`bun run build`)
- [ ] Environment variables set
- [ ] Database migrated (`bun run db:migrate`)
- [ ] Secrets rotated (AUTH_SECRET, ENCRYPTION_KEY)
- [ ] API credentials configured
- [ ] Email provider configured (Resend)
- [ ] Domain configured (NEXTAUTH_URL)

## 📞 Getting Help

1. Check `AGENTS.md` for detailed documentation
2. Check `TESTING.md` for test-specific help
3. Run `bun run validate` to check implementation
4. Check error messages carefully
5. Review recent changes in `IMPLEMENTATION_SUMMARY.md`
