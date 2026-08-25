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
} else if (!existsSync(join(distDir, "assets"))) {
  console.warn("[collect-dist] warning: no static client folder found in dist/.");
} else {
  console.log("[collect-dist] statics already at dist/ root (no dist/client to flatten).");
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


// 3. Point the server bundle at the flattened statics, then drop dist/client.
const serverWrangler = join(distDir, "server", "wrangler.json");
if (existsSync(serverWrangler)) {
  try {
    const cfg = JSON.parse(readFileSync(serverWrangler, "utf8"));
    if (cfg.assets) cfg.assets.directory = "..";
    writeFileSync(serverWrangler, JSON.stringify(cfg, null, 2) + "\n");
  } catch (err) {
    console.warn("[collect-dist] warning: could not rewrite server/wrangler.json —", err.message);
  }
}
// Keep the server bundle and the runtime install out of the served asset set.
// (dist/node_modules would include the ~122 MiB workerd binary and abort startup.)
writeFileSync(
  join(distDir, ".assetsignore"),
  [
    "/server",
    ".assetsignore",
    "package.json",
    "package-lock.json",
    "start.mjs",
    "deploy-frontend.sh",
    "ecosystem.config.cjs",
    ".env.runtime",
    "node_modules",
    "/node_modules",
    "/.runtime",
    "",
  ].join("\n"),
);

rmSync(clientDir, { recursive: true, force: true });

// 4. Remove build-machinery leftovers and local caches.
for (const name of DROP_AT_ROOT) {
  rmSync(join(distDir, name), { recursive: true, force: true });
}
rmSync(join(root, ".wrangler"), { recursive: true, force: true });
rmSync(outputDir, { recursive: true, force: true });

// 5. Drop the static shell in as dist/index.html — nginx serves it via
//    `root .../dist; index index.html;`. scripts/build.mjs captures it during
//    the shell pass and points TSS_SHELL_HTML at it.
//
//    NOT for self-host builds: there the shell comes from a different Vite pass
//    than dist/assets/, so its hashed <script> names do not exist in the final
//    asset folder — the browser then 404s on every chunk. The Node server
//    (dist/server) renders the HTML itself, so no static shell is needed.
const selfHost = process.env.SELF_HOST === "1";
const shellHtml = process.env.TSS_SHELL_HTML;
if (selfHost) {
  rmSync(join(distDir, "index.html"), { force: true });
  console.log("[collect-dist] self-host build: no static index.html (the Node server renders HTML)");
} else if (shellHtml && existsSync(shellHtml) && !existsSync(join(distDir, "index.html"))) {
  const rewritten = rewriteHtmlAssetReferencesForCurrentAssets(
    readFileSync(shellHtml, "utf8"),
    "static shell",
  );
  if (!rewritten.ok) {
    console.error(
      "[collect-dist] static shell references entry script assets that the app pass did not emit.",
    );
    for (const file of [...rewritten.unresolved].sort()) console.error(`  MISS index.html -> /assets/${file}`);
    console.error("Do not deploy it. Delete dist/, .output/ and .wrangler/, then rebuild.");
    process.exit(1);
  }
  writeFileSync(join(distDir, "index.html"), rewritten.html);
  copied.push("index.html");
}

if (!selfHost && !existsSync(join(distDir, "index.html"))) {
  console.error(
    [
      "[collect-dist] dist/index.html is missing.",
      "Run the full build (`npm run build`), which builds the static shell first",
      "via scripts/build.mjs — `vite build` alone does not produce it.",
    ].join("\n"),
  );
  process.exit(1);
}

// 5b. Consistency gate: every hashed asset referenced by shipped HTML must
//     exist in this dist/. This is what catches a mixed build (server bundle
//     from one pass, assets/ from another) before it can be deployed.
const assetsDir = join(distDir, "assets");
function rewriteHtmlAssetReferencesForCurrentAssets(html, label) {
  const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  const HASHED = /^(.*)-[A-Za-z0-9_-]{6,}(\.[A-Za-z0-9]+)$/;
  const byLogicalName = new Map();

  for (const file of assetFiles) {
    const m = file.match(HASHED);
    if (m) byLogicalName.set(m[1] + m[2], file);
  }

  const unresolved = new Set();
  const rewritten = html.replace(/\/assets\/([^"'?#>\s]+)/g, (full, file) => {
    if (existsSync(join(assetsDir, file))) return full;
    const m = file.match(HASHED);
    const replacement = m ? byLogicalName.get(m[1] + m[2]) : undefined;
    if (replacement) return `/assets/${replacement}`;
    unresolved.add(file);
    return full;
  });

  const cleaned = unresolved.size
    ? rewritten.replace(/<link\b[^>]*>/g, (tag) =>
        [...unresolved].some((file) => tag.includes(file)) ? "" : tag,
      )
    : rewritten;
  const brokenScript = [...unresolved].some((file) =>
    new RegExp(`<script[^>]*${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(cleaned),
  );

  if (brokenScript) {
    return { html: cleaned, ok: false, unresolved };
  }
  if (unresolved.size) {
    console.warn(
      `[collect-dist] ${label}: removed ${unresolved.size} stale preload/stylesheet asset reference(s).`,
    );
  }
  return { html: cleaned, ok: true, unresolved };
}

const missingAssets = new Set();
for (const name of readdirSync(distDir)) {
  if (!name.endsWith(".html")) continue;
  const html = readFileSync(join(distDir, name), "utf8");
  for (const match of html.matchAll(/(?:src|href)="\/(assets\/[^"?#]+)"/g)) {
    if (!existsSync(join(distDir, match[1]))) missingAssets.add(`${name} -> /${match[1]}`);
  }
}
if (missingAssets.size) {
  console.error("[collect-dist] this build is inconsistent — HTML references files that do not exist:");
  for (const entry of [...missingAssets].sort()) console.error(`  MISS ${entry}`);
  console.error("Do not deploy it. Delete dist/, .output/ and .wrangler/, then rebuild.");
  process.exit(1);
}
console.log(
  `[collect-dist] asset check OK — ${existsSync(assetsDir) ? readdirSync(assetsDir).length : 0} file(s) in assets/`,
);

// 5b-bis. Self-host safety net: keep a client-boot shell INSIDE the server bundle
//     (server/ssr-fallback.html, never at dist/ root so nginx can't serve it).
//     src/server.ts replies with it when SSR throws, so the app still loads in
//     the browser instead of showing a dead error page.
if (selfHost && shellHtml && existsSync(shellHtml)) {
  const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  const HASHED = /^(.*)-[A-Za-z0-9_-]{6,}(\.[A-Za-z0-9]+)$/;
  const byLogicalName = new Map();
  for (const file of assetFiles) {
    const m = file.match(HASHED);
    if (m) byLogicalName.set(m[1] + m[2], file);
  }

  const unresolved = new Set();
  let html = readFileSync(shellHtml, "utf8").replace(
    /\/assets\/([^"'?#>\s]+)/g,
    (full, file) => {
      if (existsSync(join(assetsDir, file))) return full;
      const m = file.match(HASHED);
      const replacement = m ? byLogicalName.get(m[1] + m[2]) : undefined;
      if (replacement) return `/assets/${replacement}`;
      unresolved.add(file);
      return full;
    },
  );

  // Drop preload/prefetch/stylesheet tags we could not map — they would only 404.
  if (unresolved.size) {
    html = html.replace(/<link\b[^>]*>/g, (tag) =>
      [...unresolved].some((file) => tag.includes(file)) ? "" : tag,
    );
  }
  const brokenScript = [...unresolved].some((file) =>
    new RegExp(`<script[^>]*${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(html),
  );

  if (brokenScript) {
    console.warn(
      "[collect-dist] skipped server/ssr-fallback.html — the shell pass entry script has no match in assets/.",
    );
  } else {
    mkdirSync(join(distDir, "server"), { recursive: true });
    writeFileSync(join(distDir, "server", "ssr-fallback.html"), html);
    console.log("[collect-dist] client-boot fallback: dist/server/ssr-fallback.html");
  }
}


// 5c. Build fingerprint, so the deploy helper can prove server/ and assets/
//     were produced by the same build.
const fingerprintSource = [
  ...(existsSync(assetsDir) ? readdirSync(assetsDir).sort() : []),
  existsSync(join(distDir, "server", "index.mjs"))
    ? String(statSync(join(distDir, "server", "index.mjs")).size)
    : "no-server",
].join("|");
let fingerprint = 0;
for (let i = 0; i < fingerprintSource.length; i += 1) {
  fingerprint = (fingerprint * 31 + fingerprintSource.charCodeAt(i)) >>> 0;
}
writeFileSync(
  join(distDir, "build-info.json"),
  JSON.stringify(
    {
      mode: selfHost ? "selfhost-node" : "worker",
      builtAt: new Date().toISOString(),
      fingerprint: fingerprint.toString(16),
      assetCount: existsSync(assetsDir) ? readdirSync(assetsDir).length : 0,
      rendersHtml: selfHost ? "server" : "static-shell",
    },
    null,
    2,
  ) + "\n",
);
console.log("[collect-dist] build fingerprint: dist/build-info.json");

console.log(`[collect-dist] dist/ ready — ${copied.length} static item(s) at the root:`);
console.log("  " + copied.sort().join("  "));
console.log("[collect-dist] final dist/ listing:");
for (const name of readdirSync(distDir).sort()) {
  const isDir = statSync(join(distDir, name)).isDirectory();
  console.log(`  ${name}${isDir ? "/" : ""}`);
}

// 6. Emit a launcher for dist/. The built dist/server/index.mjs only *exports*
//    a fetch handler — it never opens a socket by itself. The launcher is
//    therefore the Node HTTP server: it loads dist/.env.runtime into
//    process.env, serves the static files in dist/, and forwards everything
//    else to that fetch handler. No wrangler, no .runtime install, no
//    Cloudflare calls — and every variable is genuinely visible to server code
//    (process.env), which is what the SAP middleware callback
//    (MIDDLEWARE_SHARED_SECRET) needs.
rmSync(join(distDir, ".runtime"), { recursive: true, force: true });
rmSync(join(distDir, "package.json"), { force: true });

const launcher = `#!/usr/bin/env node
/**
 * Launcher + HTTP server for the built app server (plain Node).
 * Usage (inside this dist/ folder):
 *   PORT=8080 HOST=0.0.0.0 node start.mjs
 * or with pm2:
 *   pm2 start ecosystem.config.cjs
 *
 * Runtime env vars live in dist/.env.runtime (KEY=value per line).
 */
import { createReadStream, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { connect } from "node:net";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";




const here = dirname(fileURLToPath(import.meta.url));

const envFile = join(here, ".env.runtime");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(String.fromCharCode(10))) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  console.log("[start] loaded env from .env.runtime");
} else {
  console.log("[start] no .env.runtime found — using the process environment as-is");
}

// Self-heal: a stray dist/node_modules (from an old wrangler-based install)
// serves no purpose now and only bloats the asset folder.
const strayModules = join(here, "node_modules");
if (existsSync(strayModules)) {
  rmSync(strayModules, { recursive: true, force: true });
  console.log("[start] removed stray dist/node_modules (not needed by the Node server)");
}

const entry = join(here, "server", "index.mjs");
if (!existsSync(entry)) {
  console.error(
    "[start] server/index.mjs not found next to start.mjs — incomplete dist/. " +
      "Rebuild with 'npm run build:selfhost' and copy the whole dist/ folder.",
  );
  process.exit(1);
}

const REQUIRED = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missingRequired = REQUIRED.filter((key) => !process.env[key]);
if (missingRequired.length) {
  console.error(
    "[start] missing required value(s) in .env.runtime: " + missingRequired.join(", "),
  );
  process.exit(1);
}

const EXPECTED = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_ID",
  "MIDDLEWARE_URL",
  "MIDDLEWARE_SHARED_SECRET",
  "MIDDLEWARE_TIMEOUT_MS",
];
const found = EXPECTED.filter((key) => !!process.env[key]);
const absent = EXPECTED.filter((key) => !process.env[key]);
console.log("[start] env present: " + (found.join(", ") || "(none)"));
if (absent.length) console.log("[start] env absent : " + absent.join(", "));
console.log("[start] node " + process.version + " on " + process.platform + " (" + here + ")");


// Warn when the service-role slot actually holds an anon key: login can then
// read config but cannot create the backend session.
try {
  const part = String(process.env.SUPABASE_SERVICE_ROLE_KEY).split(".")[1];
  if (part) {
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (json && json.role && json.role !== "service_role") {
      console.warn(
        "[start] warning: SUPABASE_SERVICE_ROLE_KEY holds a '" +
          json.role +
          "' key. Use SERVICE_ROLE_KEY from supabase/.env.",
      );
    }
  }
} catch {
  /* not a JWT-format key — nothing to check */
}

const port = Number(process.env.PORT ?? "8080");
const host = process.env.HOST ?? "0.0.0.0";
process.env.PORT = String(port);
process.env.HOST = host;
process.env.NITRO_PORT ??= String(port);
// NITRO_HOST is a host, not a port. Passing the port here made a standalone
// server bundle try to bind an address like "8080".
process.env.NITRO_HOST ??= host;
// React picks its dev/prod runtime from NODE_ENV at import time, so this must
// be set BEFORE the bundle is imported below.
if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = "production";

async function portIsOpen() {
  return await new Promise((done) => {
    const probe = connect({ port, host: host === "0.0.0.0" ? "127.0.0.1" : host });
    const finish = (value) => { probe.destroy(); done(value); };
    probe.once("connect", () => finish(true));
    probe.once("error", () => finish(false));
    probe.setTimeout(1000, () => finish(false));
  });
}

console.log("[start] loading " + entry);
const mod = await import(pathToFileURL(entry).href);
const handler = mod.default ?? mod;

// Two valid build shapes:
//   a) the bundle EXPORTS a fetch handler  -> this launcher is the HTTP server
//   b) the bundle IS a standalone server   -> it already opened its own socket
const fetchHandler = typeof handler?.fetch === "function" ? handler : null;

if (!fetchHandler) {
  console.log("[start] no fetch export — treating server/index.mjs as a standalone Node server");
  let up = false;
  for (let i = 0; i < 30 && !up; i += 1) {
    up = await portIsOpen();
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) {
    console.error(
      "[start] server/index.mjs neither exports a fetch handler nor opened a listener on " +
        host + ":" + port + " — this dist/ is not a usable build.\\n" +
        "[start] Rebuild with 'npm run build:selfhost' and copy the WHOLE folder across:\\n" +
        "[start]   rsync -a --delete dist/ <server>:<path>/frontend/dist/",
    );
    process.exit(1);
  }
  console.log("[start] listening on http://" + host + ":" + port + " (standalone bundle)");
}


// ---------------------------------------------------------------- static files
const MIME = {
  ".css": "text/css; charset=utf-8", ".gif": "image/gif", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".jpeg": "image/jpeg", ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf", ".png": "image/png", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};
const staticRoot = resolve(process.env.STATIC_ROOT ?? here);
const BLOCKED = ["server", ".env", "start.mjs", "ecosystem.config.cjs", "deploy-frontend.sh"];

function resolveStatic(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes("\\0")) return null;
  const candidate = resolve(join(staticRoot, normalize(decoded)));
  if (candidate !== staticRoot && !candidate.startsWith(staticRoot + sep)) return null;
  const rel = candidate.slice(staticRoot.length + 1);
  if (BLOCKED.some((b) => rel === b || rel.startsWith(b))) return null;
  try {
    const info = statSync(candidate);
    if (!info.isFile()) return null;
    return { file: candidate, size: info.size };
  } catch { return null; }
}

// ------------------------------------------------------------- node <-> fetch
function toWebRequest(req) {
  const url = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "127.0.0.1"));
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else headers.set(key, value);
  }
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(url, {
    method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
  });
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") headers[key] = value;
  });
  const cookies = response.headers.getSetCookie?.();
  if (cookies && cookies.length) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  if (!response.body) { res.end(); return; }
  Readable.fromWeb(response.body).pipe(res);
}

if (fetchHandler) {
  const server = createServer((req, res) => {
    void (async () => {
      try {
        const { pathname } = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "127.0.0.1"));
        if (req.method === "GET" || req.method === "HEAD") {
          const found = resolveStatic(pathname);
          if (found) {
            res.writeHead(200, {
              "content-type": MIME[extname(found.file).toLowerCase()] ?? "application/octet-stream",
              "content-length": String(found.size),
              "cache-control": pathname.startsWith("/assets/")
                ? "public, max-age=31536000, immutable"
                : "public, max-age=0, must-revalidate",
            });
            if (req.method === "HEAD") { res.end(); return; }
            createReadStream(found.file).pipe(res);
            return;
          }
        }
        // SSR + /_serverFn/* + /api/*
        const upstream = await fetchHandler.fetch(toWebRequest(req), process.env, undefined);
        // A 5xx produced *inside* the app (SSR render error) never reaches the catch
        // below, so log it here — otherwise pm2 logs stay silent while the browser
        // shows a blank page.
        if (upstream && upstream.status >= 500) {
          console.error("[server] " + req.method + " " + req.url + " -> HTTP " + upstream.status +
            " (rendered by the app; check the stack trace above/below)");
        }
        await sendWebResponse(res, upstream);
      } catch (error) {
        console.error("[server] request failed:", req.method, req.url, error);
        if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("Internal Server Error");
      }
    })();
  });

  server.on("error", (error) => {
    console.error("[start] cannot bind " + host + ":" + port + " —", error.message ?? error);
    process.exit(1);
  });

  // "listening" is printed only from the listen callback, so a log line can never
  // claim the app is up while the port is actually closed.
  server.listen(port, host, () => {
    console.log("[start] listening on http://" + host + ":" + port);
    console.log("[start] static root: " + staticRoot);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

`;

writeFileSync(join(distDir, "start.mjs"), launcher);

// 6b. Bake the runtime env file from the local .env so nothing has to be edited
//     on the server. Only server-relevant keys are copied (VITE_* is already
//     compiled into the browser bundle). Always LF.
const SERVER_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_ID",
  "MIDDLEWARE_URL",
  "MIDDLEWARE_SHARED_SECRET",
  "MIDDLEWARE_TIMEOUT_MS",
];

function readEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const localEnv = { ...readEnvFile(join(root, ".env")), ...readEnvFile(join(root, ".env.production")) };
// Accept VITE_ aliases as a fallback for the shared values.
const aliases = {
  SUPABASE_URL: "VITE_SUPABASE_URL",
  SUPABASE_PUBLISHABLE_KEY: "VITE_SUPABASE_PUBLISHABLE_KEY",
  SUPABASE_ANON_KEY: "VITE_SUPABASE_PUBLISHABLE_KEY",
  SUPABASE_PROJECT_ID: "VITE_SUPABASE_PROJECT_ID",
  MIDDLEWARE_URL: "VITE_MIDDLEWARE_URL",
};

const MUST_HAVE = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MIDDLEWARE_URL",
  "MIDDLEWARE_SHARED_SECRET",
];
// PORT/HOST/NODE_ENV are per-environment (Quality 8080, Production 8090), so
// take them from the frontend .env (or the build environment) and fall back to
// the historical Quality defaults only when nothing is set.
const appPort = localEnv.PORT ?? process.env.APP_PORT ?? process.env.PORT ?? "8080";
const appHost = localEnv.HOST ?? process.env.APP_HOST ?? "0.0.0.0";
const appNodeEnv = localEnv.NODE_ENV ?? "production";
const runtimeLines = [
  "# generated by npm run build — edit frontend/.env instead",
  `NODE_ENV=${appNodeEnv}`,
  `PORT=${appPort}`,
  `HOST=${appHost}`,
];
const missing = [];
for (const key of SERVER_ENV_KEYS) {
  const value = localEnv[key] ?? (aliases[key] ? localEnv[aliases[key]] : undefined) ?? process.env[key];
  if (value) runtimeLines.push(`${key}=${value}`);
  else if (MUST_HAVE.includes(key)) {
    missing.push(key);
    runtimeLines.push(`${key}=`);
  }
}
writeFileSync(join(distDir, ".env.runtime"), runtimeLines.join("\n") + "\n");
if (missing.length && selfHost) {
  // Self-host builds run as their own app server, so an empty value here is a
  // guaranteed runtime failure. Fail now instead of on the Quality box.
  console.error(
    [
      `[collect-dist] cannot finish: dist/.env.runtime would ship with empty ${missing.join(", ")}.`,
      `Add the value(s) to ${join(root, ".env")} (SUPABASE_PUBLISHABLE_KEY is the ANON_KEY of your`,
      "self-hosted Supabase), then delete dist/ and build again.",
    ].join("\n"),
  );
  process.exit(1);
} else if (missing.length) {
  // Lovable preview/publish (worker build) gets these from the platform, not .env.
  console.warn(
    `[collect-dist] note: dist/.env.runtime has empty ${missing.join(", ")} (only needed for self-hosting).`,
  );
} else {
  console.log("[collect-dist] runtime env: dist/.env.runtime generated from .env");
}


// 6b-bis. The publishable key is also COMPILED INTO the browser bundle. If no
//     emitted JS chunk contains it, the app boots to
//     "Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY"
//     in the browser even though the server env is perfect. Fail here instead.
const bakedKey =
  localEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  localEnv.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
if (bakedKey && existsSync(assetsDir)) {
  const needle = bakedKey.slice(0, 40);
  const hasKey = readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .some((name) => readFileSync(join(assetsDir, name), "utf8").includes(needle));
  if (!hasKey) {
    console.error(
      [
        "[collect-dist] the browser bundle does not contain VITE_SUPABASE_PUBLISHABLE_KEY.",
        "The app would load and immediately show:",
        "  Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY",
        `Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in ${join(root, ".env")},`,
        "delete dist/, and build again.",
      ].join("\n"),
    );
    process.exit(1);
  }
  console.log("[collect-dist] browser bundle carries the Supabase publishable key");
}


// 6c. pm2 config so the server side is a single command.
const pm2Name = process.env.PM2_NAME ?? (appNodeEnv === "production" && appPort === "8090" ? "Prod_App" : "Qty_App");
const ecosystem = `// generated by npm run build — pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "${pm2Name}",
      script: "start.mjs",
      cwd: __dirname,
      interpreter: "node",
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "${appNodeEnv}",
        PORT: "${appPort}",
        HOST: "${appHost}",
      },

    },
  ],
};
`;
writeFileSync(join(distDir, "ecosystem.config.cjs"), ecosystem);
console.log("[collect-dist] pm2 config: dist/ecosystem.config.cjs");


// 7. Ship the one-command deploy helper next to what it manages.
//    Always write LF endings: a CRLF copy (Windows checkout) makes bash fail
//    with "$'\r': command not found" on the server.
const helper = join(root, "scripts", "deploy-frontend.sh");
if (existsSync(helper)) {
  const helperText = readFileSync(helper, "utf8").replace(/\r\n/g, "\n");
  writeFileSync(join(distDir, "deploy-frontend.sh"), helperText, { mode: 0o755 });
  console.log("[collect-dist] deploy helper: dist/deploy-frontend.sh (run `bash deploy-frontend.sh`)");
}


console.log(
  selfHost
    ? `[collect-dist] HTML is rendered by the app server — point nginx \`location /\` at port ${appPort}`
    : "[collect-dist] static shell: dist/index.html (nginx root)",
);

console.log("[collect-dist] app server bundle: dist/server (start with `node start.mjs`).");


