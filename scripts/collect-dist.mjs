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
const shellHtml = process.env.TSS_SHELL_HTML;
if (shellHtml && existsSync(shellHtml) && !existsSync(join(distDir, "index.html"))) {
  cpSync(shellHtml, join(distDir, "index.html"));
  copied.push("index.html");
}

if (!existsSync(join(distDir, "index.html"))) {
  console.error(
    [
      "[collect-dist] dist/index.html is missing.",
      "Run the full build (`npm run build`), which builds the static shell first",
      "via scripts/build.mjs — `vite build` alone does not produce it.",
    ].join("\n"),
  );
  process.exit(1);
}


console.log(`[collect-dist] dist/ ready — ${copied.length} static item(s) at the root:`);
console.log("  " + copied.sort().join("  "));
console.log("[collect-dist] final dist/ listing:");
for (const name of readdirSync(distDir).sort()) {
  const isDir = statSync(join(distDir, name)).isDirectory();
  console.log(`  ${name}${isDir ? "/" : ""}`);
}
// 6. Emit a self-contained runtime for dist/ so the folder can start itself on a
//    server with `npm install --prefix .runtime && node start.mjs`.
//    The install MUST live in dist/.runtime (never dist/node_modules): the whole
//    dist/ folder is the served asset directory and the workerd binary (~122 MiB)
//    exceeds the 25 MiB per-asset limit, which aborts startup.
const runtimePkg = {
  name: "app-server-runtime",
  private: true,
  type: "module",
  dependencies: { wrangler: "^4.45.0" },
};
mkdirSync(join(distDir, ".runtime"), { recursive: true });
writeFileSync(
  join(distDir, ".runtime", "package.json"),
  JSON.stringify(runtimePkg, null, 2) + "\n",
);
rmSync(join(distDir, "package.json"), { force: true });

const launcher = `#!/usr/bin/env node
/**
 * Self-contained launcher for the built app server.
 * Usage (inside this dist/ folder):
 *   npm install --omit=dev --prefix .runtime
 *   PORT=8080 HOST=127.0.0.1 node start.mjs
 *
 * Optional: put runtime env vars in dist/.env.runtime (KEY=value per line).
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
}

const serverDir = join(here, "server");
if (!existsSync(join(serverDir, "index.mjs"))) {
  console.error("[start] server/index.mjs not found next to start.mjs — incomplete dist/.");
  process.exit(1);
}

const port = process.env.PORT ?? "8080";
const host = process.env.HOST ?? "127.0.0.1";

// Offline/air-gapped servers: skip the Cloudflare metadata download and telemetry,
// otherwise startup blocks on a timeout and the local server reload-loops.
if (process.env.CI === undefined) process.env.CI = "true";
if (process.env.WRANGLER_SEND_METRICS === undefined) process.env.WRANGLER_SEND_METRICS = "false";
if (process.env.NO_COLOR === undefined) process.env.NO_COLOR = "1";
console.log("[start] offline mode: CI=true, WRANGLER_SEND_METRICS=false");

const isWin = process.platform === "win32";
const localBin = join(here, ".runtime", "node_modules", ".bin", isWin ? "wrangler.cmd" : "wrangler");
if (!existsSync(localBin)) {
  console.error(
    "[start] wrangler is not installed. Run: npm install --omit=dev --prefix .runtime",
  );
  process.exit(1);
}

console.log(\`[start] serving app server on http://\${host}:\${port}\`);

const child = spawn(
  localBin,
  ["dev", "--cwd", serverDir, "--ip", host, "--port", port, "--no-live-reload"],
  { stdio: "inherit", cwd: here, env: process.env, shell: isWin },
);
child.on("exit", (code) => process.exit(code ?? 0));
`;
writeFileSync(join(distDir, "start.mjs"), launcher);

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


