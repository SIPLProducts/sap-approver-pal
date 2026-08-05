# Build output: single `dist` folder, no functional changes

Clarified goal: `npm run build` must produce one `dist` folder containing the app's files. SAP, login, email, push and every screen keep working exactly as they do today. Nothing moves to the middleware, no code is rewritten.

## Good news: this already happens

The build script is already `vite build && node scripts/collect-dist.mjs`, and the collector already:

- flattens all static files (`assets/`, `templates/`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, sitemap/robots if present) into `dist/`
- copies anything from `public/` the build did not emit
- deletes the duplicate `dist/client/` folder
- removes `.output/`, `.wrangler/`, `nitro.json` and other build leftovers
- keeps `dist/server/` (the part that renders pages and runs SAP/login calls) and adds `.assetsignore` so it is never served as a public file

So the deployable artefact is already just `dist/`.

## What this task does

1. Run a clean production build in the sandbox and print the final `dist/` listing, to confirm on this exact codebase that the output is one folder with the flat statics plus `server/`.
2. If any stray folder (`.output/`, `.wrangler/`, `dist/client/`) survives the run, fix `scripts/collect-dist.mjs` so it is folded in or removed. No app code touched.
3. Update `DEPLOY-QUALITY.md` with the verified listing and the two deployment steps: copy `dist/`, run `npm start`, nginx proxies to it.

## About `index.html`

There is no `index.html` in `dist/`, and adding one is not needed. In your other project the browser loads `index.html` and boots the app. Here the HTML for each page is produced by `dist/server` at request time — that is what makes login and the SAP screens work on first load. `npm start` runs it; nginx serves `dist/assets` and the other static files directly.

Nothing about SAP or login changes in this task.
