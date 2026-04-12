# Test Suite

This directory contains smoke tests for critical API endpoints and functionality.

## Running Tests

```bash
# Run all tests once
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run lint, build, and tests together
bun run check
```

## Test Structure

- `setup.ts` - Test environment setup and global mocks
- `api-credentials.test.ts` - Smoke tests for API credentials endpoints
- `sync-jobs.test.ts` - Smoke tests for sync job creation and status tracking

## What These Tests Cover

### API Credentials (`api-credentials.test.ts`)
- ✅ Authentication checks (401 for unauthenticated/non-admin)
- ✅ GET endpoint returns masked credentials
- ✅ POST endpoint validates provider types
- ✅ POST endpoint creates/updates credentials
- ✅ DELETE endpoint removes credentials

### Sync Jobs (`sync-jobs.test.ts`)
- ✅ Authentication checks (401 for unauthenticated/non-admin)
- ✅ Source type validation (400 for invalid sources)
- ✅ Client existence validation (404 for non-existent clients)
- ✅ Sync job creation with correct initial status
- ✅ Sync job updates on success/failure
- ✅ Error handling and exception catching

## Test Philosophy

These are **smoke tests** - they verify that:
1. Critical endpoints are accessible
2. Authentication/authorization works
3. Basic validation is in place
4. Database operations are called correctly
5. Error handling doesn't crash the app

They use mocks extensively to avoid:
- Real database operations
- Real API calls
- File system operations
- Network requests

## Adding New Tests

1. Create a new `.test.ts` file in this directory
2. Import test utilities from `vitest`
3. Mock external dependencies (db, auth, integrations)
4. Write focused tests for specific functionality
5. Run `bun run test` to verify

## CI/CD Integration

The `check` script runs lint + build + test in sequence. Use this before:
- Committing changes
- Opening pull requests
- Deploying to production

```bash
bun run check
```

If this passes, you're good to commit.
