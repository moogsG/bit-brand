import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // Force Turbopack to treat THIS project as the root.
    // Without this, Next may infer the root from a parent-directory lockfile
    // (e.g. /Users/moogs/workspace/package-lock.json), which can destabilize dev.
    root: projectRoot,
  },
};

export default nextConfig;
