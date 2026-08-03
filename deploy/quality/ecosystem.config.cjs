/**
 * PM2 ecosystem — QUALITY
 * Install at /data/webapplication/resl_approval/Quality/scripts/ecosystem.config.cjs
 *
 *   pm2 start ecosystem.config.cjs && pm2 save
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = "/data/webapplication/resl_approval/Quality";

/** Parse a dotenv file into an object. Returns {} when absent. */
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const appEnv = readEnv(path.join(ROOT, "frontend/.env.runtime"));

// wrangler needs each runtime value passed explicitly with --var KEY:VALUE
const vars = Object.entries(appEnv)
  .filter(([k]) => k !== "PORT" && k !== "NODE_ENV")
  .map(([k, v]) => `--var ${k}:${JSON.stringify(v)}`)
  .join(" ");

module.exports = {
  apps: [
    {
      // ---- TanStack Start SSR app (serves HTML and /api/*) ----
      name: "resl-quality-app",
      cwd: `${ROOT}/frontend/current`,
      script: "npx",
      args: `wrangler dev dist/server/index.js --config dist/server/wrangler.json --local --ip 127.0.0.1 --port ${appEnv.PORT || 3000} ${vars}`,
      interpreter: "none",
      env: { NODE_ENV: "production", PORT: appEnv.PORT || "3000" },
      instances: 1,
      exec_mode: "fork",           // workerd manages its own concurrency
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "20s",
      max_memory_restart: "1G",
      kill_timeout: 10000,         // let in-flight SSR requests finish
      out_file: `${ROOT}/logs/app-out.log`,
      error_file: `${ROOT}/logs/app-err.log`,
      merge_logs: true,
      time: true,
    },
    {
      // ---- SAP middleware (Express) ----
      name: "resl-quality-mw",
      cwd: `${ROOT}/backend`,
      script: "server.js",
      interpreter: "node",
      env: { NODE_ENV: "production" },
      env_file: `${ROOT}/backend/.env`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "20s",
      max_memory_restart: "512M",
      kill_timeout: 10000,
      out_file: `${ROOT}/logs/middleware-out.log`,
      error_file: `${ROOT}/logs/middleware-err.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
