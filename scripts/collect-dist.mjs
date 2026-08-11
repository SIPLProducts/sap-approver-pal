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
  cpSync(shellHtml, join(distDir, "index.html"));
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

// 6. Emit a launcher for dist/. The self-host build (`npm run build:selfhost`)
//    produces dist/server/index.mjs as a plain Node HTTP server, so the
//    launcher only has to load dist/.env.runtime into process.env and import
//    it. No wrangler, no .runtime install, no Cloudflare calls — and every
//    variable is genuinely visible to server code (process.env), which is what
//    the SAP middleware callback (MIDDLEWARE_SHARED_SECRET) needs.
rmSync(join(distDir, ".runtime"), { recursive: true, force: true });
rmSync(join(distDir, "package.json"), { force: true });

const launcher = `#!/usr/bin/env node
/**
 * Launcher for the built app server (plain Node).
 * Usage (inside this dist/ folder):
 *   PORT=8080 HOST=0.0.0.0 node start.mjs
 * or with pm2:
 *   pm2 start ecosystem.config.cjs
 *
 * Runtime env vars live in dist/.env.runtime (KEY=value per line).
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
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

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
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

const port = process.env.PORT ?? "8080";
const host = process.env.HOST ?? "0.0.0.0";
process.env.PORT = port;
process.env.HOST = host;
process.env.NITRO_PORT ??= port;
process.env.NITRO_HOST ??= host;
if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = "production";

console.log(\`[start] booting app server for http://\${host}:\${port}\`);
await import(pathToFileURL(entry).href);

// The self-host bundle (src/server.node.ts) sets this flag from inside the
// listen() callback. If it is still unset shortly after the import resolved,
// the bundle is NOT a listening Node server (e.g. a worker-style build was
// deployed by mistake) — fail loudly instead of idling on a dead port, so pm2
// and deploy-frontend.sh cannot report a false success.
await new Promise((done) => setTimeout(done, 1500));
if (!globalThis.__RESL_APP_LISTENING__) {
  console.error(
    "[start] server/index.mjs finished loading without opening a listener on port " +
      port +
      ".\\n" +
      "[start] This dist/ was NOT built for self-hosting. Rebuild with 'npm run build:selfhost'\\n" +
      "[start] and copy the whole folder across with: rsync -a --delete dist/ <server>:<path>/dist/",
  );
  process.exit(1);
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

const runtimeLines = ["# generated by npm run build — edit frontend/.env instead", "NODE_ENV=production", "PORT=8080", "HOST=0.0.0.0"];
const missing = [];
for (const key of SERVER_ENV_KEYS) {
  const value = localEnv[key] ?? (aliases[key] ? localEnv[aliases[key]] : undefined);
  if (value) runtimeLines.push(`${key}=${value}`);
  else if (["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MIDDLEWARE_URL", "MIDDLEWARE_SHARED_SECRET"].includes(key)) {
    missing.push(key);
    runtimeLines.push(`${key}=`);
  }
}
writeFileSync(join(distDir, ".env.runtime"), runtimeLines.join("\n") + "\n");
if (missing.length) {
  console.warn(
    `[collect-dist] warning: dist/.env.runtime has empty ${missing.join(", ")} — add them to frontend/.env and rebuild.`,
  );
} else {
  console.log("[collect-dist] runtime env: dist/.env.runtime generated from .env");
}

// 6c. pm2 config so the server side is a single command.
const ecosystem = `// generated by npm run build — pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "Qty_App",
      script: "start.mjs",
      cwd: __dirname,
      interpreter: "node",
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: "8080",
        HOST: "0.0.0.0",
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


console.log("[collect-dist] static shell: dist/index.html (nginx root)");
console.log("[collect-dist] app server bundle: dist/server (start with `node start.mjs`).");


