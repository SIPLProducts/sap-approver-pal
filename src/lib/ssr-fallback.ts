// Client-boot fallback shell.
//
// When SSR throws, the app used to be a dead end (a static error page). Instead
// we serve the pre-rendered client shell that the build emitted next to the
// server bundle (`server/ssr-fallback.html`): the browser loads the same hashed
// assets and TanStack Router renders the requested route client-side, so the
// login page keeps working while the SSR fault is being diagnosed.

let cached: string | null | undefined;

async function loadShell(): Promise<string | null> {
  try {
    const [fs, path, url] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("node:url"),
    ]);

    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const candidates = [
      path.join(here, "ssr-fallback.html"),
      path.join(here, "server", "ssr-fallback.html"),
      path.join(process.cwd(), "server", "ssr-fallback.html"),
      path.join(process.cwd(), "ssr-fallback.html"),
    ];

    for (const candidate of candidates) {
      try {
        const html = await fs.readFile(candidate, "utf8");
        if (html.trim()) return html;
      } catch {
        /* try the next candidate */
      }
    }
  } catch {
    /* no filesystem (e.g. Worker runtime) — no fallback available */
  }
  return null;
}

export async function getSsrFallbackShell(): Promise<string | null> {
  if (cached === undefined) cached = await loadShell();
  return cached;
}

/** Only documents benefit from a client-boot shell; data/API calls must keep failing loudly. */
export function wantsHtmlDocument(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) return false;
  const path = new URL(request.url).pathname;
  return !path.startsWith("/api/") && !path.startsWith("/_serverFn/");
}
