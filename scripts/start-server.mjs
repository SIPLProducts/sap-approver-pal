#!/usr/bin/env node
/**
 * Start the built app server (dist/) for self-hosted deployments.
 *
 * The production bundle is built for the Workers runtime, so it is served with
 * wrangler (workerd), which ships with the project and runs fine on Linux.
 * Nginx should proxy to HOST:PORT set below.
 *
 * Env:
 *   PORT  (default 8080)
 *   HOST  (default 127.0.0.1 — use 0.0.0.0 to expose directly)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
if (!existsSync(join(distDir, "server", "index.mjs"))) {
  console.error("[start] dist/server not found — run `npm run build` first.");
  process.exit(1);
}

const port = process.env.PORT ?? "8080";
const host = process.env.HOST ?? "127.0.0.1";

console.log(`[start] serving dist/ on http://${host}:${port}`);

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "dev", "--cwd", "dist/server", "--ip", host, "--port", port],
  { stdio: "inherit", env: process.env },
);

child.on("exit", (code) => process.exit(code ?? 0));
