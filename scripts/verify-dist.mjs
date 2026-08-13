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
import { spawn } from "node:child_process";
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

// ------------------------------- 3b. baked Supabase publishable key (browser)
// The browser reads import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, which is
// compiled in. When it is absent the app loads and immediately shows
// "Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY" —
// unfixable on the server, so catch it before the folder leaves this machine.
const runtimeEnvPath = join(distDir, ".env.runtime");
if (existsSync(runtimeEnvPath) && existsSync(assetsDir)) {
  const line = readFileSync(runtimeEnvPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("SUPABASE_PUBLISHABLE_KEY="));
  const key = line
    ? line.slice("SUPABASE_PUBLISHABLE_KEY=".length).trim().replace(/^["']|["']$/g, "")
    : "";
  if (!key && info?.mode === "selfhost-node") {
    bad("dist/.env.runtime has no SUPABASE_PUBLISHABLE_KEY — the app server cannot reach the backend");
  } else if (key) {

    const needle = key.slice(0, 40);
    const baked = readdirSync(assetsDir)
      .filter((name) => name.endsWith(".js"))
      .some((name) => readFileSync(join(assetsDir, name), "utf8").includes(needle));
    if (baked) ok("browser bundle carries the Supabase publishable key");
    else
      bad(
        "no JS chunk contains the Supabase publishable key — this bundle was built without " +
          "VITE_SUPABASE_PUBLISHABLE_KEY. Set it in .env, delete dist/, and rebuild.",
      );
  }
}


// ------------------------------------------------- 4. React runtime sanity
// `jsxDevRuntimeExports.jsxDEV is not a function` at render time comes from a
// development JSX runtime inside a production React bundle. Catch it statically.
const serverEntry = join(distDir, "server", "index.mjs");
if (existsSync(serverEntry)) {
  const serverDir = join(distDir, "server");
  const jsFiles = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(mjs|js|cjs)$/.test(name)) jsFiles.push(full);
    }
  };
  walk(serverDir);
  const offenders = jsFiles.filter((file) => {
    const text = readFileSync(file, "utf8");
    return text.includes("jsx-dev-runtime") || text.includes("jsxDEV");
  });
  if (offenders.length) {
    bad(
      `${offenders.length} server file(s) reference React's development JSX runtime — ` +
        "SSR will throw 'jsxDEV is not a function'. Rebuild with NODE_ENV=production.",
    );
    for (const file of offenders.slice(0, 5)) {
      console.log(`        DEV-JSX ${file.slice(distDir.length + 1)}`);
    }
  } else {
    ok("no development JSX runtime in the server bundle");
  }
}

// ---------------------------------------------- 5. runtime gate (self-host)
// The decisive check: actually boot dist/start.mjs and request /login. A folder
// that cannot serve its own login page must never reach a server.
if (problems.length === 0 && info?.mode === "selfhost-node") {
  const port = 8000 + Math.floor(Math.random() * 1500);
  console.log(`[verify-dist] boot test on 127.0.0.1:${port} …`);
  const child = spawn(process.execPath, ["start.mjs"], {
    cwd: distDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      SUPABASE_URL: process.env.SUPABASE_URL || "http://127.0.0.1:8000",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "verify-dist-placeholder",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));

  let exited = false;
  child.on("exit", () => (exited = true));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let response = null;
  for (let i = 0; i < 60 && !exited && !response; i += 1) {
    await sleep(500);
    try {
      response = await fetch(`http://127.0.0.1:${port}/login`);
    } catch {
      response = null;
    }
  }

  if (!response) {
    bad(
      exited
        ? "start.mjs exited instead of serving — the launcher and server/index.mjs do not match"
        : "start.mjs never answered on its port within 30s",
    );
  } else {
    const body = await response.text();
    if (response.status >= 500) {
      bad(`/login returned HTTP ${response.status} from the built server`);
    } else if (!/<html/i.test(body)) {
      bad("/login did not return an HTML document");
    } else if (/Missing Supabase environment variable/i.test(body)) {
      bad(
        "/login rendered 'Missing Supabase environment variable' — the browser bundle was built " +
          "without VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Set them in .env and rebuild.",
      );
    } else {
      ok(`/login served HTTP ${response.status} by the built server`);
      if (response.headers.get("x-ssr-fallback")) {
        notes.push("/login came from the client-boot fallback, not real SSR");
        console.log("   NOTE /login used the client-boot fallback (SSR threw) — see the log below");
      }
    }


    // Probe several statics: one lucky asset must not mask a path mismatch.
    const jsAssets = existsSync(assetsDir)
      ? readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
      : [];
    const cssAssets = existsSync(assetsDir)
      ? readdirSync(assetsDir).filter((f) => f.endsWith(".css"))
      : [];
    const probes = [
      ...[jsAssets[0], jsAssets[Math.floor(jsAssets.length / 2)], jsAssets.at(-1)]
        .filter(Boolean)
        .map((f) => `/assets/${f}`),
      ...cssAssets.map((f) => `/assets/${f}`),
      ...(existsSync(join(distDir, "manifest.webmanifest")) ? ["/manifest.webmanifest"] : []),
      ...(existsSync(join(distDir, "re-sustainability-logo.jpg"))
        ? ["/re-sustainability-logo.jpg"]
        : []),
    ];
    for (const path of [...new Set(probes)]) {
      try {
        const assetRes = await fetch(`http://127.0.0.1:${port}${path}`);
        const contentType = assetRes.headers.get("content-type") ?? "";
        const expectedType = path.endsWith(".css")
          ? "text/css"
          : path.endsWith(".js")
            ? "javascript"
            : null;
        if (!assetRes.ok) bad(`${path} returned HTTP ${assetRes.status}`);
        else if (expectedType && !contentType.includes(expectedType)) {
          bad(`${path} returned wrong content-type ${contentType || "(missing)"}`);
        } else ok(`served ${path} (${contentType || "content-type missing"})`);
      } catch {
        bad(`could not fetch ${path} from the running server`);
      }
    }

  }

  if (!exited) child.kill("SIGTERM");
  await sleep(300);
  if (!exited) child.kill("SIGKILL");
  if (problems.length) {
    console.log("--- start.mjs output ---");
    console.log(log.split("\n").slice(-40).join("\n"));
  }
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

