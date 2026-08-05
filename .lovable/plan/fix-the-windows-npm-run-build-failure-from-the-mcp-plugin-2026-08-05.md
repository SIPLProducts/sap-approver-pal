# Fix the Windows `npm run build` failure from the MCP plugin

## What's happening

This is not a problem with your app code. The MCP build plugin compares two versions of the same folder path: Vite hands it the project root with forward slashes (`D:/VPCL_Ramky/sap-approver-pal`), while the plugin builds the routes folder with Windows backslashes (`D:\VPCL_Ramky\sap-approver-pal\src\routes`). The safety check that verifies "routes live inside the project" then fails, so the build aborts before it starts.

Confirmed in the installed package: version `0.24.0` of `@lovable.dev/mcp-js` does the comparison without normalizing separators. That is why the build works in Lovable (Linux) and fails only on your Windows machine.

## Plan

1. Upgrade `@lovable.dev/mcp-js` to the latest version (it already has a separator-normalization exclusion in `bunfig.toml`, so the install guard won't block it).
2. Re-run the build to confirm the error is gone.
3. If the latest version still has the same check, add a small Windows-safe guard: keep `mcpPlugin()` active as today, but pass an explicit forward-slash `routesDir` so both sides of the comparison match on Windows too.
4. Leave the MCP server behavior, tools, and routes unchanged — this is purely a build-time path fix.

## Technical detail

- `node_modules/@lovable.dev/mcp-js/dist/stacks/tanstack/vite.js` → `assertContains(parent, child)` uses `child.startsWith(parent + sep)`; on Windows `sep` is `\` while `parent` arrives normalized with `/`, so the check can never pass.
- Fix path A: `npm install @lovable.dev/mcp-js@latest` (or `bun add`) — upstream fix.
- Fix path B (fallback, in `vite.config.ts`): `mcpPlugin({ routesDir: "src/routes" })` combined with a normalized root, or conditionally skip the plugin on `process.platform === "win32"` local builds. Skipping is a last resort since it would drop the `/mcp` routes from that local build output.

## Note

You can also build in WSL as an immediate workaround, but the version upgrade is the real fix.
