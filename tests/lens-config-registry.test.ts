import { describe, expect, it } from "vitest";
import {
	LENS_CONFIG_VERSION,
	getLensConfig,
	lensKeySchema,
	resolveLensKeyFromModule,
	validateLensRegistry,
} from "@/lib/ai/lens-config";

describe("lens config registry", () => {
	it("registry validates against schema", () => {
		expect(validateLensRegistry()).toEqual({ ok: true });
	});

	it("has entries for all known lens keys", () => {
		const keys = lensKeySchema.options;
		for (const key of keys) {
			const cfg = getLensConfig(key as any);
			expect(cfg.version).toBe(LENS_CONFIG_VERSION);
			expect(cfg.key).toBe(key);
			expect(cfg.allowedActions.length).toBeGreaterThan(0);
			// Safety invariant.
			expect(cfg.safePreviewOnly).toBe(true);
		}
	});

	it("resolves lens key from module aliases", () => {
		expect(resolveLensKeyFromModule("keywords")).toBe("keywords");
		expect(resolveLensKeyFromModule("reports")).toBe("reporting");
		expect(resolveLensKeyFromModule("ai-visibility")).toBe("prompt-research");
	});
});
