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
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

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

// The archive is what actually reaches the server, so audit the archive — not
// only the folder it came from. A truncated tar is indistinguishable from a
// hand-picked SFTP copy once it is extracted, and both 404/500 at render time.
const listed = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
if (listed.status !== 0) {
  console.error("[package-dist] could not read back the archive listing — do not deploy it.");
  process.exit(listed.status ?? 1);
}
const inArchive = new Set(
  listed.stdout
    .split("\n")
    .map((line) => line.trim().replace(/^\.\//, "").replace(/\/$/, ""))
    .filter(Boolean),
);

function collectFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(distDir, full).split(sep).join("/"));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

const mustContain = [
  "start.mjs",
  "build-info.json",
  "deploy-frontend.sh",
  ...collectFiles(join(distDir, "server")),
  ...collectFiles(join(distDir, "client", "assets")),
];
const absent = mustContain.filter((entry) => !inArchive.has(entry));
if (absent.length) {
  console.error(`[package-dist] the archive is missing ${absent.length} required file(s):`);
  for (const entry of absent.slice(0, 20)) console.error(`  MISS ${entry}`);
  if (absent.length > 20) console.error(`  … and ${absent.length - 20} more`);
  console.error("[package-dist] refusing to hand over a partial archive. Rebuild and repackage.");
  process.exit(1);
}
console.log(
  `[package-dist] archive audit OK — ${mustContain.length} required file(s) present (server/ + client/assets/).`,
);

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
