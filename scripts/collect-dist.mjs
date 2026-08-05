#!/usr/bin/env node
/**
 * Post-build step: make the top-level `dist/` folder self-describing and
 * flat-ish, similar to a plain Vite SPA build output.
 *
 * The Vite/Nitro build already emits:
 *   dist/client/**   -> static client assets (assets/, favicon.ico, sw.js, ...)
 *   dist/server/**   -> server bundle (SSR + server functions)
 *
 * This script copies the static client files up into `dist/` so nginx can
 * serve them directly (and so the folder looks like the familiar
 * `dist/assets`, `dist/favicon.ico`, ... layout), while leaving
 * `dist/client` and `dist/server` intact because the app server needs them.
 *
 * Pure Node, no dependencies, works on Windows and Linux.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = join(root, "dist");
const clientDir = join(distDir, "client");

if (!existsSync(distDir)) {
  console.error("[collect-dist] dist/ not found — run `vite build` first.");
  process.exit(1);
}

if (!existsSync(clientDir)) {
  console.error("[collect-dist] dist/client not found — nothing to collect.");
  process.exit(1);
}

// Names that belong to the build machinery and must not be overwritten.
const RESERVED = new Set(["client", "server", "nitro.json", "package.json", "package-lock.json"]);

const entries = readdirSync(clientDir);
const copied = [];

for (const name of entries) {
  if (RESERVED.has(name)) continue;
  const from = join(clientDir, name);
  const to = join(distDir, name);
  // Replace any stale copy from a previous build.
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  copied.push(statSync(from).isDirectory() ? `${name}/` : name);
}

// Also surface anything the project ships in public/ that the build may keep
// only inside the server bundle's public dir (robots.txt, sitemap.xml, ...).
const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  for (const name of readdirSync(publicDir)) {
    if (RESERVED.has(name)) continue;
    const to = join(distDir, name);
    if (existsSync(to)) continue; // build output wins
    cpSync(join(publicDir, name), to, { recursive: true });
    copied.push(name);
  }
}

// Keep dist/ writable for a fresh run.
mkdirSync(distDir, { recursive: true });

console.log(`[collect-dist] copied ${copied.length} item(s) into dist/:`);
console.log("  " + copied.sort().join("  "));
console.log("[collect-dist] server bundle kept at dist/server (run with `npm start`).");
