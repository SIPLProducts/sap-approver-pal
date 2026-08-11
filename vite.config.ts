// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { sep } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Windows fix: the MCP plugin compares Vite's resolved root (always forward slashes)
// against paths built with node:path (backslashes on Windows), which makes its
// "routes must live under the project" check fail and aborts `vite build`.
// Hand the plugin a root that uses the platform separator so both sides match.
// No-op on POSIX (sep === "/").
function windowsSafeMcpPlugin() {
  const plugins = [mcpPlugin()].flat() as any[];
  if (sep === "/") return plugins;

  return plugins.map((plugin) => {
    if (!plugin || typeof plugin !== "object") return plugin;
    const hook = plugin.configResolved;
    const handler = typeof hook === "function" ? hook : hook?.handler;
    if (typeof handler !== "function") return plugin;

    const patched = function (this: unknown, config: any, ...rest: any[]) {
      const proxy = new Proxy(config, {
        get(target, prop, receiver) {
          if (prop === "root" && typeof target.root === "string") {
            return target.root.split("/").join(sep);
          }
          return Reflect.get(target, prop, receiver);
        },
      });
      return handler.call(this, proxy, ...rest);
    };

    return {
      ...plugin,
      configResolved:
        typeof hook === "function" ? patched : { ...hook, handler: patched },
    };
  });
}

// Pin the build output directory to ./dist on every platform. Without this the
// server build can fall back to ".output" (seen on Windows), which breaks the
// post-build collector and the deployment docs.
process.env.NITRO_OUTPUT_DIR ||= "dist";

// `npm run build` runs two passes (see scripts/build.mjs):
//
//   shell pass (TSS_SHELL_PASS=1) — nitro is skipped so the plain Node server
//     build stays importable, which lets the framework prerender a static shell
//     into dist/client/index.html.
//   app pass (default) — the normal nitro/worker build that produces
//     dist/server, i.e. every server function (SAP, login, e-mail, push, admin).
//
// The collector then places the saved shell at dist/index.html so nginx can use
// `root .../frontend/dist; index index.html;` while dist/server keeps serving
// all server-function traffic.
const isShellPass = process.env.TSS_SHELL_PASS === "1";

// `npm run build:selfhost` (SELF_HOST=1) builds the app pass for a plain Node
// HTTP server instead of the Cloudflare worker runtime. That is what the
// self-hosted Quality/Production servers run: `node dist/start.mjs` on 8080,
// a normal Node process that sees process.env directly — no wrangler, no
// workerd binary, no Cloudflare metadata calls. Lovable preview/publish keep
// the default worker build because SELF_HOST is unset there.
const isSelfHost = process.env.SELF_HOST === "1";

// The bundled MCP helper dynamically imports `cloudflare:workers` to read secrets
// from the worker env binding. That module does not exist outside workerd, so the
// Node build fails to resolve it. Provide an empty stub: the helper already falls
// back to process.env, which is the correct source on a self-hosted Node server.
function cloudflareWorkersStub() {
  const id = "cloudflare:workers";
  const resolved = "\0virtual:cloudflare-workers-stub";
  return {
    name: "self-host-cloudflare-workers-stub",
    enforce: "pre" as const,
    resolveId(source: string) {
      return source === id ? resolved : null;
    },
    load(loadedId: string) {
      return loadedId === resolved ? "export const env = {};\nexport default { env };\n" : null;
    },
  };
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  ...(isShellPass
    ? { nitro: false as const }
    : isSelfHost
      ? {
          nitro: {
            preset: "node-server" as const,
            output: {
              dir: "dist",
              serverDir: "dist/server",
              publicDir: "dist/client",
            },
          },
        }
      : {}),
  tanstackStart: {
    // Both builds share this entry. For self-hosting, dist/start.mjs wraps the
    // exported fetch handler in a real Node http listener (so PORT/HOST bind).
    server: { entry: "server" },
    ...(isShellPass


      ? {
          spa: {
            enabled: true,
            prerender: {
              enabled: true,
              outputPath: "/index.html",
              crawlLinks: false,
            },
          },
        }
      : {}),
  },
  vite: {
    plugins: [windowsSafeMcpPlugin(), ...(isSelfHost ? [cloudflareWorkersStub()] : [])],
  },
});


