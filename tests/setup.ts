import { beforeAll, afterAll, vi } from "vitest";

// Mock environment variables for tests
beforeAll(() => {
	process.env.AUTH_SECRET = "test-secret-key-for-testing-only";
	process.env.NEXTAUTH_URL = "http://localhost:3000";
	process.env.DATABASE_URL = ":memory:";
	process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars!!";
});

afterAll(() => {
	vi.clearAllMocks();
});
