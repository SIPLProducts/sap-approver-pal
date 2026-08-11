/**
 * Self-hosted (plain Node) server entry.
 *
 * `npm run build:selfhost` builds this file instead of src/server.ts, so the
 * produced dist/server/index.mjs really opens a TCP listener on HOST:PORT.
 * The Cloudflare/Lovable build keeps using src/server.ts unchanged.
 *
 * Responsibilities:
 *   1. serve the flattened static files in dist/ (assets/, favicon, sw.js, …)
 *   2. hand everything else to the shared fetch handler from src/server.ts
 *      (SSR + /_serverFn/* + /api/*)
 *   3. only log "listening" from the successful listen callback
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";

import app from "./server";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

/**
 * Where the flattened statics live. The launcher (dist/start.mjs) runs with
 * cwd = dist/, so process.cwd() is the right default. STATIC_ROOT overrides it.
 */
const staticRoot = resolve(process.env["STATIC_ROOT"] ?? process.cwd());

/** Resolve a URL path to a file inside staticRoot, or null when unsafe/absent. */
async function resolveStaticFile(pathname: string): Promise<{ file: string; size: number } | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const candidate = resolve(join(staticRoot, normalize(decoded)));
  // Never serve outside the static root, and never serve the server bundle or
  // the runtime secrets file.
  if (candidate !== staticRoot && !candidate.startsWith(staticRoot + sep)) return null;
  const relative = candidate.slice(staticRoot.length + 1);
  if (
    relative.startsWith("server") ||
    relative.startsWith(".env") ||
    relative === "start.mjs" ||
    relative === "ecosystem.config.cjs" ||
    relative === "deploy-frontend.sh"
  ) {
    return null;
  }

  try {
    const info = await stat(candidate);
    if (!info.isFile()) return null;
    return { file: candidate, size: info.size };
  } catch {
    return null;
  }
}

function toWebRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);

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
    ...(hasBody
      ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half" }
      : {}),
  } as RequestInit & { duplex?: "half" });
}

async function sendWebResponse(res: ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    headers[key] = value;
  });
  const cookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (cookies?.length) headers["set-cookie"] = cookies;

  res.writeHead(response.status, headers);

  if (!response.body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  nodeStream.pipe(res);
  await new Promise<void>((done) => {
    nodeStream.on("end", () => done());
    nodeStream.on("error", () => {
      res.destroy();
      done();
    });
  });
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      const host = req.headers.host ?? "127.0.0.1";
      const { pathname } = new URL(req.url ?? "/", `http://${host}`);

      // 1. static files straight from disk (assets/ is content-hashed)
      if (req.method === "GET" || req.method === "HEAD") {
        const found = await resolveStaticFile(pathname);
        if (found) {
          const type = MIME[extname(found.file).toLowerCase()] ?? "application/octet-stream";
          const immutable = pathname.startsWith("/assets/");
          res.writeHead(200, {
            "content-type": type,
            "content-length": String(found.size),
            "cache-control": immutable
              ? "public, max-age=31536000, immutable"
              : "public, max-age=0, must-revalidate",
          });
          if (req.method === "HEAD") {
            res.end();
            return;
          }
          createReadStream(found.file).pipe(res);
          return;
        }
      }

      // 2. everything else: SSR, /_serverFn/*, /api/*
      const response = await app.fetch(toWebRequest(req), process.env, undefined);
      await sendWebResponse(res, response);
    } catch (error) {
      console.error("[server] request failed:", error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    }
  })();
});

const port = Number(process.env["PORT"] ?? 8080);
const host = process.env["HOST"] ?? "0.0.0.0";

server.on("error", (error) => {
  console.error("[server] failed to bind " + host + ":" + port + " —", error);
  process.exit(1);
});

server.listen(port, host, () => {
  // Only now is the socket really open. dist/start.mjs checks this flag so a
  // non-listening bundle can never be reported as a successful start.
  (globalThis as { __RESL_APP_LISTENING__?: boolean }).__RESL_APP_LISTENING__ = true;
  console.log(`[server] listening on http://${host}:${port} (static root: ${staticRoot})`);
});

export default app;
