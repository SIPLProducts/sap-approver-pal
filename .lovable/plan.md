# Publish the latest PO Release changes

The PO Release code is already correct in the project (verified this turn):

- `src/lib/mm/po-release.functions.ts` detects `STATUS: "FALSE"` and returns the exact `MSGTXT` without adding rows.
- `src/routes/_authenticated/mm.po-release.tsx` shows that message in the response dialog.

So this is a delivery gap, not a code gap: frontend changes only reach `sap-approver-pal.lovable.app` and `smartapps.siplproducts.com` after a publish, and an open tab can keep serving the old bundle.

## Steps

1. Run a security scan check, then publish the project so the live URLs serve the current build.
2. Hard-refresh the live site once (Ctrl/Cmd+Shift+R) and re-test PO Release -> Execute with a plant that returns "No POs Found".
3. If it still shows old behaviour after the refresh, capture the exact SAP response for that call so the message extraction can be matched to the real payload shape.

No code or logic changes are made in steps 1-2, and step 3 only happens if the refreshed live site still misbehaves.

## Note on the self-hosted Quality server

Publishing does not update `10.150.150.130:8081`. That deployment needs a fresh `npm run build` (or `--selfhost`) `dist` copied over and `scripts/deploy-frontend.sh` re-run, with `dist/`, `.output/` and `.wrangler/` deleted first so no stale hashed assets remain.
