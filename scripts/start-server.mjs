#!/usr/bin/env node
/**
 * Start the built app server (dist/) for self-hosted deployments.
 *
 * `npm run build:selfhost` emits dist/server/index.mjs as a plain Node HTTP
 * server, so this just delegates to the generated dist/start.mjs launcher
 * (which loads dist/.env.runtime and boots the bundle). No wrangler, no
 * workerd, no Cloudflare calls.
 *
 * Nginx should proxy HOST:PORT (both /_serverFn/ and /api/) to this process.
 *
 * Env:
 *   PORT  (default 8080)
 *   HOST  (default 0.0.0.0)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const launcher = join(distDir, "start.mjs");
const entry = join(distDir, "server", "index.mjs");

if (!existsSync(entry)) {
  console.error("[start] dist/server/index.mjs not found — run `npm run build:selfhost` first.");
  process.exit(1);
}

const target = existsSync(launcher) ? launcher : entry;
const port = process.env.PORT ?? "8080";
const host = process.env.HOST ?? "0.0.0.0";

console.log(`[start] serving dist/ on http://${host}:${port}`);

const child = spawn(process.execPath, [target], {
  stdio: "inherit",
  cwd: distDir,
  env: { ...process.env, PORT: port, HOST: host },
});

child.on("exit", (code) => process.exit(code ?? 0));
