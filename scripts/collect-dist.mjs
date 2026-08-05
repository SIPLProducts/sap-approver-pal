#!/usr/bin/env node
/**
 * Post-build step: guarantee a single, clean top-level `dist/` folder,
 * whichever layout the build produced.
 *
 * Supported build outputs:
 *   dist/client + dist/server        (normal case)
 *   .output/public + .output/server  (fallback seen on some machines/Windows)
 *
 * Result:
 *   dist/
 *     assets/ templates/ favicon.ico sitemap.xml sw.js ...  (flattened statics)
 *     server/    <- app server bundle (npm start)
 *     .assetsignore
 *   ...and no .output/, no .wrangler/, no dist/client duplicate.
 *
 * Pure Node, no dependencies, safe on Windows and Linux.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = join(root, "dist");
const outputDir = join(root, ".output");

// Names that belong to the build machinery and must not be overwritten at dist root.
const RESERVED = new Set(["client", "server", "nitro.json", "package.json", "package-lock.json"]);

// Build-machinery files that are not needed for deployment.
const DROP_AT_ROOT = ["nitro.json", "package.json", "package-lock.json", "wrangler.json"];

function copyInto(from, to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}


/** Normalise a `.output/` build into `dist/`. */
function adoptOutputDir() {
  mkdirSync(distDir, { recursive: true });

  const publicSrc = join(outputDir, "public");
  const serverSrc = join(outputDir, "server");

  if (existsSync(publicSrc)) copyInto(publicSrc, join(distDir, "client"));
  if (existsSync(serverSrc)) copyInto(serverSrc, join(distDir, "server"));

  for (const name of ["nitro.json", "package.json", "package-lock.json", "wrangler.json"]) {
    const from = join(outputDir, name);
    if (existsSync(from)) copyInto(from, join(distDir, name));
  }

  // The build artefact is now dist/ only — drop the duplicate.
  rmSync(outputDir, { recursive: true, force: true });
  console.log("[collect-dist] normalised .output/ into dist/ (and removed .output/)");
}

const hasDistLayout = existsSync(join(distDir, "client")) || existsSync(join(distDir, "server"));
const hasOutputLayout =
  existsSync(join(outputDir, "public")) || existsSync(join(outputDir, "server"));

if (hasOutputLayout) {
  adoptOutputDir();
} else if (!hasDistLayout) {
  console.error(
    [
      "[collect-dist] no build output found. Looked for:",
      "  dist/client + dist/server",
      "  .output/public + .output/server",
      "Run `vite build` first.",
    ].join("\n"),
  );
  process.exit(1);
}

const clientDir = join(distDir, "client");
const copied = [];

// 1. Flatten the static client files into dist/ root.
if (existsSync(clientDir)) {
  for (const name of readdirSync(clientDir)) {
    if (RESERVED.has(name)) continue;
    const from = join(clientDir, name);
    copyInto(from, join(distDir, name));
    copied.push(statSync(from).isDirectory() ? `${name}/` : name);
  }
} else {
  console.warn("[collect-dist] warning: no static client folder found in dist/.");
}

// 2. Add anything from public/ that the build did not emit (robots.txt, sitemap.xml, ...).
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

console.log(`[collect-dist] dist/ ready — ${copied.length} static item(s) at the root:`);
console.log("  " + copied.sort().join("  "));
console.log("[collect-dist] app server bundle: dist/server (run with `npm start`).");
