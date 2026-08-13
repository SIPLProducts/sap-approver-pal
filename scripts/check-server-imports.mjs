#!/usr/bin/env node
/**
 * Prove that a built server bundle is COMPLETE.
 *
 * The self-host server bundle is code-split: dist/server/index.mjs and its
 * chunks import further chunks, some of them lazily (`import("./x.mjs")`).
 * A missing chunk therefore does not break startup at all — the process boots,
 * answers "/" and only explodes at render time with:
 *
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find module
 *     '.../dist/server/_authenticated-XXXXXXXX.mjs'
 *
 * This script resolves every relative import found in the bundle and reports
 * the ones whose target file is not on disk. It is used by:
 *   - scripts/verify-dist.mjs   (local build gate)
 *   - dist/deploy-frontend.sh   (before pm2 restart on the server)
 *
 * Usage:
 *   node check-server-imports.mjs [serverDir]     # default: ./server
 * Exit code 0 = complete, 1 = incomplete (do not deploy / do not restart).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const JS = /\.(mjs|js|cjs)$/;

/** Every relative specifier the bundle references, static or dynamic. */
const SPECIFIER_PATTERNS = [
  /\bfrom\s*["'](\.[^"']+)["']/g, //            import x from "./y.mjs"
  /\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g, // await import("./y.mjs")
  /\bimport\s*["'](\.[^"']+)["']/g, //          import "./y.mjs"
  /\brequire\s*\(\s*["'](\.[^"']+)["']\s*\)/g, // require("./y.cjs")
];

function listJsFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (JS.test(name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/** Node ESM does not guess extensions, but be forgiving for CJS-ish specifiers. */
function resolveTarget(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = JS.test(specifier)
    ? [base]
    : [base, `${base}.mjs`, `${base}.js`, `${base}.cjs`, join(base, "index.mjs"), join(base, "index.js")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * @returns {{ checked: number, missing: Array<{ from: string, specifier: string }> }}
 */
export function checkServerImports(serverDir) {
  const dir = resolve(serverDir);
  if (!existsSync(dir)) return { checked: 0, missing: [], noServerDir: true };

  const files = listJsFiles(dir);
  const missing = [];
  const seen = new Set();

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of SPECIFIER_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        const key = `${file}|${specifier}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!resolveTarget(file, specifier)) {
          missing.push({ from: relative(dir, file), specifier });
        }
      }
    }
  }
  return { checked: files.length, missing };
}

// ------------------------------------------------------------------- CLI mode
const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (invokedDirectly) {
  const target = process.argv[2] ?? "server";
  const result = checkServerImports(target);

  if (result.noServerDir) {
    console.error(`[server-imports] ${resolve(target)} does not exist — incomplete build.`);
    process.exit(1);
  }
  if (result.missing.length === 0) {
    console.log(`[server-imports] OK — ${result.checked} server file(s), every imported chunk present.`);
    process.exit(0);
  }

  console.error(
    `[server-imports] FAIL — ${result.missing.length} imported server chunk(s) are missing:`,
  );
  for (const entry of result.missing.slice(0, 40)) {
    console.error(`  MISS ${entry.specifier}   (imported by server/${entry.from})`);
  }
  if (result.missing.length > 40) console.error(`  … and ${result.missing.length - 40} more`);
  console.error(
    [
      "",
      "The server bundle is incomplete: it boots, but SSR throws ERR_MODULE_NOT_FOUND.",
      "Never copy or start this folder. Rebuild and transfer it as ONE archive:",
      "  rm -rf dist .output .wrangler",
      "  npm run build:selfhost",
      "  npm run package:dist",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
