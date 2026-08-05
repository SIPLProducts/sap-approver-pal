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

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [windowsSafeMcpPlugin()],
  },
});

