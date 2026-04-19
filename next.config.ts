import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// In a git worktree, node_modules lives in the main repo root, not the worktree
// directory. Walk up until we find the directory that actually has node_modules/next.
function findNextRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "node_modules", "next"))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

const nextConfig: NextConfig = {
  turbopack: {
    root: findNextRoot(__dirname),
  },
  transpilePackages: ["wagmi", "viem", "@wagmi/core"],
  // Cesium ships a prebuilt bundle that ESM-resolves fine in the browser,
  // but we mark it as an external package for the server runtime so Next
  // doesn't try to bundle its worker scripts. Workers are served as static
  // assets from /public/cesium (copied by scripts/copy-cesium-assets.mjs).
  serverExternalPackages: ["cesium"],
};

export default nextConfig;
