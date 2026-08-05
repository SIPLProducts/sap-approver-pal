# Make the build produce one clean `dist/` folder

## Why your other project looks different

The project in screenshot 1 is a plain front-end-only app: its whole build is static files plus `index.html`, so `dist/` looks flat and simple.

This app is not front-end-only. It has 26 server-side modules (SAP login, PR/PO/ZNFA/MIGO release, BMW report, user management, e-mail, push notifications). Those run on a small app server. So the build must always emit:

- the static files (assets, favicon, sitemap, robots, sw, templates)
- one `server/` folder containing the app server that talks to SAP

Turning this into a screenshot-1-style static folder would mean rewriting every SAP/e-mail/push call to live in the separate middleware service. That is a large, risky rework, and it is not what you asked for — you asked for a clean `dist/`. So the plan keeps the app working and cleans up the output.

## Target result after `npm run build`

```text
project root
  dist/            <- the only build artefact, ship this
  (no .output/, no .wrangler/ left behind)

dist/
  assets/          static JS/CSS
  templates/       e-mail templates
  server/          app server (started with: npm start)
  _headers
  _redirects
  favicon.ico
  manifest.webmanifest
  placeholder.svg
  ramky-logo.png
  robots.txt
  sitemap.xml
  sw.js
```

That is your screenshot-1 layout, minus `index.html`, with the single required addition of `server/`.

### Where is `index.html`?

There isn't one, and there shouldn't be. In your other project `index.html` is the entry file the browser loads and the app boots from it in the browser. Here the page HTML is generated per request by `dist/server` (that is what makes SAP data render on first load and what powers login/approval server calls). So the entry point of this app is `dist/server`, started with `npm start`; nginx proxies to it and serves `dist/assets` and the other static files directly.


## What will change

1. `scripts/collect-dist.mjs`
   - after flattening the static files to the `dist/` root, delete the now-duplicate `dist/client/` folder so the same files are not shipped twice
   - delete leftover build-machinery files at the `dist/` root that are not needed for deployment (`nitro.json`, generated `package.json` / `package-lock.json`) and keep only what the server needs
   - remove the `.wrangler/` cache folder from the project root at the end of the build
   - print the final `dist/` listing so you can confirm it matches
2. `scripts/start-server.mjs`
   - verify it still resolves the server bundle after `dist/client` is removed, and point it at `dist/server` explicitly
3. `.gitignore`
   - ignore `.wrangler/`, `.output/`, `.tanstack/` so those never show up in your project listing again
4. `DEPLOY-QUALITY.md`
   - update the "what to copy to the server" section to the final layout above

## Technical notes

- `NITRO_OUTPUT_DIR=dist` is already pinned in `vite.config.ts`, so the `.output/` fallback you saw earlier stays handled.
- `.wrangler/` is only a local build cache; deleting it does not affect the built app.
- Nothing in `src/` changes, so no application behaviour or screen is touched.

## Verification

Run a build in the sandbox and list `dist/` and the project root to confirm the layout matches the target and that `.output/` and `.wrangler/` are gone.
