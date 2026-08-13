#!/usr/bin/env node
/**
 * Verify dist/ and pack it into ONE archive for transport.
 *
 * A single archive removes the classic deployment fault: hand-picking files or
 * folders in an SFTP client, which leaves old hashed assets next to a new server
 * bundle and 404s every chunk in the browser.
 *
 * Usage:
 *   npm run package:dist          -> quality-frontend-dist.tar.gz
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = join(root, "dist");
const archive = join(root, "quality-frontend-dist.tar.gz");

const verify = spawnSync(
  process.execPath,
  [join(root, "scripts", "verify-dist.mjs"), "--expect", "selfhost-node"],
  { stdio: "inherit" },
);
if (verify.status !== 0) {
  console.error("[package-dist] refusing to package an unverified dist/.");
  process.exit(verify.status ?? 1);
}

const tar = spawnSync("tar", ["-C", distDir, "-czf", archive, "."], { stdio: "inherit" });
if (tar.error || tar.status !== 0) {
  console.error(
    [
      "[package-dist] could not run tar.",
      "On Windows use PowerShell 5+ (tar is bundled) or copy dist/ with:",
      "  rsync -a --delete dist/ user@server:/…/frontend/dist/",
    ].join("\n"),
  );
  process.exit(tar.status ?? 1);
}

if (!existsSync(archive)) {
  console.error("[package-dist] tar reported success but the archive is missing.");
  process.exit(1);
}

const mib = (statSync(archive).size / (1024 * 1024)).toFixed(1);
console.log(`\n[package-dist] ready: quality-frontend-dist.tar.gz (${mib} MiB)`);
console.log(
  [
    "",
    "On the server:",
    "  cd /data/webapplication/resl_approval/Quality/frontend",
    '  mv dist "dist-broken-$(date +%Y%m%d-%H%M%S)"',
    "  mkdir dist && tar -xzf quality-frontend-dist.tar.gz -C dist",
    "  cd dist && bash deploy-frontend.sh",
    "",
  ].join("\n"),
);
