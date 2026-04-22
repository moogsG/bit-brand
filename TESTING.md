# Testing Guide

## Quick Start

```bash
# 1. Install dependencies (if not already done)
bun install

# 2. Validate implementation
bun run validate

# 3. Run tests
bun run test

# 4. Run full check (lint + build + test)
bun run check
```

## Available Test Commands

| Command | Description |
|---------|-------------|
| `bun run test` | Run all tests once |
| `bun run test:watch` | Run tests in watch mode (re-runs on file changes) |
| `bun run test:coverage` | Run tests with coverage report |
| `bun run check` | Run lint + build + test (CI/CD ready) |
| `bun run validate` | Validate implementation completeness |

## Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── api-credentials.test.ts     # API credentials endpoint tests
├── sync-jobs.test.ts           # Sync jobs creation tests
└── README.md                   # Test documentation
```

## What's Tested

### API Credentials (`/api/settings/api-credentials`)

**GET Endpoint:**
- ✅ Returns 401 for unauthenticated requests
- ✅ Returns 401 for non-admin users
- ✅ Returns masked credentials for admin users

**POST Endpoint:**
- ✅ Returns 401 for unauthenticated requests
- ✅ Returns 400 for invalid provider types
- ✅ Creates new credentials for valid providers
- ✅ Updates existing credentials

**DELETE Endpoint:**
- ✅ Returns 401 for unauthenticated requests
- ✅ Returns 400 for invalid provider types
- ✅ Deletes credentials for valid providers

### Sync Jobs (`/api/sync/[clientId]/[source]`)

**POST Endpoint:**
- ✅ Returns 401 for unauthenticated requests
- ✅ Returns 401 for non-admin users
- ✅ Returns 400 for invalid source types
- ✅ Returns 404 for non-existent clients
- ✅ Creates sync job with correct initial status
- ✅ Updates sync job on success
- ✅ Updates sync job on failure
- ✅ Handles exceptions properly

**Data Integrity:**
- ✅ Sync jobs created with RUNNING status
- ✅ Sync jobs updated with completion data
- ✅ Error messages captured in job records

## Test Philosophy

These are **smoke tests** designed to:
1. Verify critical endpoints are accessible
2. Ensure authentication/authorization works
3. Validate input validation is in place
4. Confirm database operations are called
5. Check error handling doesn't crash

They use **extensive mocking** to:
- Avoid real database operations
- Avoid real API calls
- Ensure fast execution
- Provide deterministic results
- Enable safe CI/CD runs

## Mock Strategy

All external dependencies are mocked:

```typescript
// Authentication
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Database
vi.mock("@/lib/db", () => ({
  db: { /* mocked methods */ },
}));

// Integrations
vi.mock("@/lib/integrations/ga4", () => ({
  syncGA4Data: vi.fn(),
}));
```

This ensures:
- ✅ No side effects
- ✅ Fast test execution
- ✅ No external dependencies
- ✅ Reproducible results

## Coverage Report

Run with coverage to see what's tested:

```bash
bun run test:coverage
```

This generates:
- Terminal summary
- HTML report in `coverage/` directory
- JSON report for CI/CD tools

**Note:** Coverage excludes:
- UI components (`src/components/**`)
- Next.js pages (`src/app/**`)
- Config files
- Type definitions

## CI/CD Integration

### GitHub Actions Example

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run check
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
bun run check
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Troubleshooting

### Tests fail with "Cannot find module"

**Solution:** Ensure path aliases are configured in `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

### Tests fail with "ENCRYPTION_KEY not set"

**Solution:** The test setup file (`tests/setup.ts`) sets this automatically. If you see this error, ensure the setup file is being loaded:

```typescript
// vitest.config.ts
test: {
  setupFiles: ["./tests/setup.ts"],
}
```

### Mocks not working

**Solution:** Ensure mocks are defined **before** importing the module under test:

```typescript
// ✅ Correct
vi.mock("@/lib/auth");
const { GET } = await import("@/app/api/route");

// ❌ Wrong
const { GET } = await import("@/app/api/route");
vi.mock("@/lib/auth"); // Too late!
```

### Coverage is 0%

**Solution:** Coverage only tracks files that are imported by tests. If a file isn't tested, it won't appear in coverage. This is expected for:
- UI components (not tested in unit tests)
- Next.js pages (tested in E2E tests)
- Utility functions (add unit tests if needed)

## Adding New Tests

### 1. Create Test File

```typescript
// tests/my-feature.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("My Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should do something", () => {
    expect(true).toBe(true);
  });
});
```

### 2. Mock Dependencies

```typescript
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
```

### 3. Write Tests

```typescript
it("should return 401 for unauthenticated requests", async () => {
  const { auth } = await import("@/lib/auth");
  vi.mocked(auth).mockResolvedValue(null);

  const { GET } = await import("@/app/api/my-route/route");
  const response = await GET();

  expect(response.status).toBe(401);
});
```

### 4. Run Tests

```bash
bun run test:watch
```

## Best Practices

### ✅ Do

- Mock all external dependencies
- Test one thing per test
- Use descriptive test names
- Clear mocks between tests
- Test error cases
- Test edge cases

### ❌ Don't

- Make real API calls
- Make real database queries
- Test implementation details
- Write flaky tests
- Skip error handling tests
- Ignore TypeScript errors

## Next Steps

### Immediate
- ✅ All smoke tests implemented

### Future Enhancements

1. **Integration Tests**
   - Use in-memory SQLite database
   - Test real database operations
   - Test transaction handling

2. **E2E Tests**
   - Use Playwright or Cypress
   - Test critical user flows
   - Test authentication flows

3. **Performance Tests**
   - Benchmark slow queries
   - Test API response times
   - Monitor memory usage

4. **Security Tests**
   - Test for XSS vulnerabilities
   - Test for SQL injection
   - Test authentication bypass attempts

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Mock Service Worker](https://mswjs.io/) - For API mocking
- [Playwright](https://playwright.dev/) - For E2E testing

## Support

If tests fail unexpectedly:

1. Check the error message
2. Verify mocks are set up correctly
3. Ensure environment variables are set (in `tests/setup.ts`)
4. Run `bun run validate` to check implementation
5. Check the test documentation in `tests/README.md`

For questions or issues, refer to the main `AGENTS.md` documentation.
