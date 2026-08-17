# Gate Pass: show the exact SAP response + get it onto smartapps.siplproducts.com

## What's going on

Two separate things are mixed together here.

1. **The code change is already in the project.** `src/lib/mm/gate-pass.functions.ts` already detects `TYPE: "E"`, extracts the exact SAP `MESSAGE`, returns no table rows, and `mm.gate-pass.tsx` already shows it in the response popup.
2. **smartapps.siplproducts.com is your own self-hosted server.** It serves the build in `/data/webapplication/resl_approval/Quality/frontend`. Publishing from Lovable updates the Lovable-hosted URL only — that server keeps serving the old bundle until you pull, rebuild and restart there. That is why the screen looks unchanged.

## Part 1 — Widen "exact API response" coverage (code)

Right now only the `TYPE: "E"` shape is turned into a popup message. Other SAP shapes fall through and either show nothing useful or show rows. Change the Gate Pass fetch so any non-success response surfaces the exact SAP text:

- Reuse the existing shared helpers in `src/lib/mm/sap-message.ts` (already used by PR/PO Release) to detect, in this order:
  - `TYPE: "E"` anywhere in the payload (already done)
  - `STATUS: "FALSE"` anywhere in the payload
  - a `MESSAGES: [{ TYPE, MESSAGE }]` array containing an `E`/`A` entry
  - a bare `MSGTXT` / `MESSAGE` with no `HEADER`/`DATA` rows
- In every one of those cases: return `header: null`, `data: []`, and `error` set to the exact SAP string, unmodified (no prefixes, no rewording).
- If SAP returns success but zero rows, show the exact `MESSAGE`/`MSGTXT` if present, otherwise "No records found".
- The popup in `mm.gate-pass.tsx` keeps its current design (same as PR/PO Release) and just renders that string.

No changes to the SAP call itself, the save/approve flows, or any other screen.

## Part 2 — Get the change live on your server

Run on the server, in `/data/webapplication/resl_approval/Quality/frontend`:

```text
git pull
rm -rf dist .output .wrangler
bun install
bun run build:dev
# restart the app service / nginx reload as you normally do
```

Then hard-refresh the browser (Ctrl+Shift+R) — the old JS bundle is cached under the previous asset hashes.

If `git pull` brings nothing, the commit hasn't reached your remote yet; tell me and I'll confirm what is in the workspace so you can push from the right place.

## Technical notes

- Files touched: `src/lib/mm/gate-pass.functions.ts` (detection + exact-message passthrough), and `src/lib/mm/sap-message.ts` only if a helper needs to be exported.
- Existing regression tests in `src/lib/mm/sap-message.test.ts` get cases for the extra Gate Pass shapes.
- No schema, RLS, or middleware changes.
