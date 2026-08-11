#!/usr/bin/env node
/**
 * Two-pass production build.
 *
 * Pass 1 — "shell": builds with nitro disabled so the plain Node server output
 *   stays importable, which lets TanStack Start prerender a static SPA shell.
 *   The resulting HTML is stashed outside dist/.
 *
 * Pass 2 — "app": the normal build that emits dist/server (SSR + every server
 *   function: SAP, login, e-mail, push, admin, MCP).
 *
 * Then scripts/collect-dist.mjs flattens dist/ and drops the saved shell in as
 * dist/index.html, so nginx can serve:
 *
 *   root /data/.../frontend/dist;
 *   index index.html;
 *
 * ...while dist/server keeps handling /_serverFn/* and /api/* traffic.
 *
 * Pure Node, no extra dependencies, works the same on Windows and Linux.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = join(root, "dist");
const shellCacheDir = join(root, "node_modules", ".cache", "tss-shell");
const shellCacheFile = join(shellCacheDir, "index.html");

// Extra CLI args are forwarded to both passes (e.g. `--mode development`).
// `--selfhost` is consumed here: it switches the app pass to the plain Node
// server preset (see vite.config.ts) so dist/ runs with `node start.mjs`.
const rawArgs = process.argv.slice(2);
const selfHost = rawArgs.includes("--selfhost") || process.env.SELF_HOST === "1";
const passthroughArgs = rawArgs.filter((arg) => arg !== "--selfhost");
if (selfHost) {
  process.env.SELF_HOST = "1";
  console.log("[build] self-host mode: the app pass targets a plain Node server.");
}

function runVite(label, env) {
  console.log(`\n[build] ${label} pass…`);
  const result = spawnSync(
    process.execPath,
    [join(root, "node_modules", "vite", "bin", "vite.js"), "build", ...passthroughArgs],
    { stdio: "inherit", env: { ...process.env, ...env } },
  );
  if (result.status !== 0) {
    console.error(`[build] ${label} pass failed.`);
    process.exit(result.status ?? 1);
  }
}

function clean() {
  for (const dir of ["dist", ".output", ".wrangler"]) {
    rmSync(join(root, dir), { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- shell pass
clean();
runVite("shell", { TSS_SHELL_PASS: "1" });

const shellCandidates = [
  join(distDir, "client", "index.html"),
  join(distDir, "index.html"),
  join(root, ".output", "public", "index.html"),
];
const shellSource = shellCandidates.find((candidate) => existsSync(candidate));

if (!shellSource) {
  console.error(
    [
      "[build] the shell pass did not produce an index.html.",
      "Looked in:",
      ...shellCandidates.map((candidate) => `  ${candidate}`),
    ].join("\n"),
  );
  process.exit(1);
}

mkdirSync(shellCacheDir, { recursive: true });
copyFileSync(shellSource, shellCacheFile);
console.log(`[build] static shell captured from ${shellSource}`);

// ------------------------------------------------------------------ app pass
clean();
runVite("app", {});

// ------------------------------------------------------------------ collect
const collect = spawnSync(process.execPath, [join(root, "scripts", "collect-dist.mjs")], {
  stdio: "inherit",
  env: { ...process.env, TSS_SHELL_HTML: shellCacheFile },
});
if ((collect.status ?? 0) !== 0) process.exit(collect.status ?? 1);

// ------------------------------------------------------------------- verify
// A build only "succeeds" when the folder it produced is actually deployable:
// complete, right mode, and with every hashed asset its HTML references.
const verify = spawnSync(
  process.execPath,
  [join(root, "scripts", "verify-dist.mjs"), "--expect", selfHost ? "selfhost-node" : "worker"],
  { stdio: "inherit" },
);
if ((verify.status ?? 0) !== 0) {
  console.error("[build] the produced dist/ is not deployable — see the failures above.");
  process.exit(verify.status ?? 1);
}
if (selfHost) {
  console.log("[build] dist/ verified. Package it with `npm run package:dist` before copying.");
}
process.exit(0);
