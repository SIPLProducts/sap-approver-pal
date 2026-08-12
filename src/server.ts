import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getSsrFallbackShell, wantsHtmlDocument } from "./lib/ssr-fallback";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

/**
 * One grep-able line first (`[ssr] Name: message`), then the stack. pm2 truncates
 * long lines, so the message must never be buried at the top of a stack dump.
 */
export function logSsrError(error: unknown, where: string): void {
  const err = error instanceof Error ? error : undefined;
  const name = err?.name ?? typeof error;
  const message = err?.message ?? String(error);
  console.error(`[ssr] ${where}: ${name}: ${message}`);
  if (err?.stack) console.error(err.stack);
  if (err?.cause) console.error(`[ssr] cause: ${String((err.cause as Error)?.message ?? err.cause)}`);
}

async function fallbackResponse(request: Request): Promise<Response> {
  if (wantsHtmlDocument(request)) {
    const shell = await getSsrFallbackShell();
    if (shell) {
      console.error("[ssr] serving the client-boot shell instead (the page renders in the browser)");
      return new Response(shell, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-ssr-fallback": "client-boot",
        },
      });
    }
    console.error("[ssr] no server/ssr-fallback.html in this bundle — showing the static error page");
  }

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  logSsrError(
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
    `render ${new URL(request.url).pathname}`,
  );
  return fallbackResponse(request);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      logSsrError(error, `fetch ${new URL(request.url).pathname}`);
      return fallbackResponse(request);
    }
  },
};
