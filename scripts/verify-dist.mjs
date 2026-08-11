#!/usr/bin/env node
/**
 * Gate a local dist/ folder before it is ever copied to a server.
 *
 * Catches the three failure modes that keep breaking the Quality deployment:
 *   1. an incomplete folder (no start.mjs / build-info.json / deploy-frontend.sh)
 *   2. a wrong-mode folder (worker build shipped to the self-hosted Node server)
 *   3. a mixed folder (HTML referencing hashed assets that are not present)
 *
 * Usage:
 *   node scripts/verify-dist.mjs                # verifies ./dist
 *   node scripts/verify-dist.mjs --dir path      # verifies another folder
 *   node scripts/verify-dist.mjs --expect selfhost-node
 *
 * Exit code 0 = safe to deploy. Anything else = do not copy this folder.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

const distDir = resolve(process.cwd(), argValue("--dir") ?? "dist");
const expectMode = argValue("--expect") ?? process.env.VERIFY_DIST_MODE ?? null;

const problems = [];
const notes = [];

function ok(msg) {
  console.log(`   OK   ${msg}`);
}
function bad(msg) {
  problems.push(msg);
  console.log(`   FAIL ${msg}`);
}

console.log(`[verify-dist] checking ${distDir}`);

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(
    [
      `[verify-dist] ${distDir} does not exist.`,
      "Run `npm run build:selfhost` (self-hosted server) or `npm run build` first.",
    ].join("\n"),
  );
  process.exit(1);
}

// ---------------------------------------------------------------- 1. contents
const REQUIRED = ["server/index.mjs", "start.mjs", "build-info.json", "deploy-frontend.sh"];
for (const rel of REQUIRED) {
  if (existsSync(join(distDir, rel))) ok(rel);
  else bad(`${rel} is missing — this folder is not a finished build`);
}

// ------------------------------------------------------------------- 2. mode
let info = null;
const infoPath = join(distDir, "build-info.json");
if (existsSync(infoPath)) {
  try {
    info = JSON.parse(readFileSync(infoPath, "utf8"));
    ok(`build mode: ${info.mode} (built ${info.builtAt})`);
  } catch (err) {
    bad(`build-info.json is not readable JSON — ${err.message}`);
  }
}
if (info && expectMode && info.mode !== expectMode) {
  bad(`build mode is "${info.mode}" but "${expectMode}" is required for this target`);
}

// A self-host bundle renders HTML from dist/server. A leftover static index.html
// at the root is precisely what makes nginx serve stale asset references.
if (info?.mode === "selfhost-node" && existsSync(join(distDir, "index.html"))) {
  bad(
    "index.html exists at the root of a self-host bundle — it is stale and will be served " +
      "instead of the app server's HTML. Rebuild into a clean, empty dist/.",
  );
}
if (info?.mode === "worker" && !existsSync(join(distDir, "index.html"))) {
  bad("worker build without dist/index.html — nginx would have no static shell to serve");
}

// --------------------------------------------------------- 3. asset integrity
const assetsDir = join(distDir, "assets");
const assetCount = existsSync(assetsDir) ? readdirSync(assetsDir).length : 0;
if (assetCount === 0) bad("assets/ is empty or missing");
else ok(`assets/: ${assetCount} file(s)`);

const missing = new Set();
for (const name of readdirSync(distDir)) {
  if (!name.endsWith(".html")) continue;
  const html = readFileSync(join(distDir, name), "utf8");
  for (const match of html.matchAll(/(?:src|href)="\/?(assets\/[^"?#]+)"/g)) {
    if (!existsSync(join(distDir, match[1]))) missing.add(`${name} -> /${match[1]}`);
  }
}
if (missing.size) {
  bad(`${missing.size} dangling asset reference(s) — server/ and assets/ come from different builds`);
  for (const entry of [...missing].sort()) console.log(`        MISS ${entry}`);
} else {
  notes.push("no dangling asset references");
  ok("no dangling asset references");
}

// A bundled node_modules (with the ~122 MiB workerd binary) aborts startup.
if (existsSync(join(distDir, "node_modules"))) {
  bad("node_modules/ inside dist/ — remove it, runtime deps are already bundled");
}

// ------------------------------------------------------------------- verdict
console.log("");
if (problems.length === 0) {
  console.log("[verify-dist] PASS — safe to deploy this folder.");
  process.exit(0);
}
console.error(`[verify-dist] FAIL — ${problems.length} problem(s):`);
for (const p of problems) console.error(`  - ${p}`);
console.error(
  [
    "",
    "Do not copy this folder to a server. Rebuild from the project root:",
    "  rm -rf dist .output .wrangler",
    "  npm run build:selfhost      # self-hosted Node app server (port 8080)",
    "",
  ].join("\n"),
);
process.exit(1);
