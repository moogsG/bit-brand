#!/usr/bin/env tsx

/**
 * Validation script to verify implementation completeness
 * Run with: bun run tsx scripts/validate-implementation.ts
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

interface ValidationResult {
	name: string;
	passed: boolean;
	message: string;
}

const results: ValidationResult[] = [];

function check(name: string, condition: boolean, message: string) {
	results.push({ name, passed: condition, message });
}

function fileExists(path: string): boolean {
	return existsSync(join(ROOT, path));
}

function fileContains(path: string, pattern: string | RegExp): boolean {
	try {
		const content = readFileSync(join(ROOT, path), "utf-8");
		if (typeof pattern === "string") {
			return content.includes(pattern);
		}
		return pattern.test(content);
	} catch {
		return false;
	}
}

console.info("🔍 Validating implementation...\n");

// 1. Check for Ahrefs/SEMrush references
check(
	"No Ahrefs references",
	!fileContains("src/lib/db/schema.ts", /ahrefs|AHREFS/i),
	"Schema should not contain Ahrefs references",
);

check(
	"No SEMrush references",
	!fileContains("src/lib/db/schema.ts", /semrush|SEMRUSH/i),
	"Schema should not contain SEMrush references",
);

// 2. Check ai_visibility secondaryScore
check(
	"Schema has secondaryScore",
	fileContains("src/lib/db/schema.ts", "secondaryScore"),
	"ai_visibility table should have secondaryScore field",
);

check(
	"Seed includes secondaryScore",
	fileContains("src/lib/db/seed.ts", "secondaryScore"),
	"Seed data should include secondaryScore",
);

// 3. Check test infrastructure
check(
	"Vitest config exists",
	fileExists("vitest.config.ts"),
	"vitest.config.ts should exist",
);

check(
	"Test setup exists",
	fileExists("tests/setup.ts"),
	"tests/setup.ts should exist",
);

check(
	"API credentials tests exist",
	fileExists("tests/api-credentials.test.ts"),
	"tests/api-credentials.test.ts should exist",
);

check(
	"Sync jobs tests exist",
	fileExists("tests/sync-jobs.test.ts"),
	"tests/sync-jobs.test.ts should exist",
);

// 4. Check package.json scripts
check(
	"Test script exists",
	fileContains("package.json", '"test":'),
	"package.json should have test script",
);

check(
	"Check script exists",
	fileContains("package.json", '"check":'),
	"package.json should have check script",
);

check(
	"Vitest dependency",
	fileContains("package.json", '"vitest":'),
	"package.json should have vitest in devDependencies",
);

// 5. Check test content
check(
	"API credentials tests have auth checks",
	fileContains("tests/api-credentials.test.ts", "Unauthorized"),
	"API credentials tests should check authentication",
);

check(
	"Sync jobs tests have validation",
	fileContains("tests/sync-jobs.test.ts", "Invalid source type"),
	"Sync jobs tests should validate source types",
);

// Print results
console.info("Results:\n");

let passed = 0;
let failed = 0;

for (const result of results) {
	const icon = result.passed ? "✅" : "❌";
  console.info(`${icon} ${result.name}`);
  if (!result.passed) {
    console.info(`   ${result.message}`);
		failed++;
	} else {
		passed++;
	}
}

console.info(`\n📊 Summary: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error("❌ Validation failed. Please fix the issues above.\n");
  process.exit(1);
} else {
  console.info("✅ All validations passed!\n");
  console.info("Next steps:");
  console.info("  1. Run: bun install");
  console.info("  2. Run: bun run test");
  console.info("  3. Run: bun run check\n");
  process.exit(0);
}
