# ZNFA Release changes aren't on the live site — publish them

The ZNFA Release work is already present in the project code (verified this turn):

- `src/lib/mm/znfa-release.functions.ts` exists and holds the SAP fetch for `ZNFA_RELEASE_GET_API`.
- `src/routes/_authenticated/mm.znfa-release.tsx` wires the Next button to that fetch, renders the results table for array responses, and shows a red alert plus toast when SAP returns `STATUS: "FALSE"`.
- Typecheck passes with no errors on those files.

You tested on the published site (`smartapps.siplproducts.com`). Frontend changes only reach the published/custom-domain build after a publish — the preview build has them, the live build does not. That fully explains "nothing happened at all" on Next: the old bundle has no fetch wired to that button.

## What to do

1. Publish the app so the current frontend bundle (including the ZNFA Release fetch, results table, and error alert) is deployed. Custom domains can take a couple of extra minutes to serve the new build.
2. Hard-refresh the live site once (Ctrl+Shift+R) so the browser drops the cached old bundle.
3. Re-test: ZNFA Release → Release → pick Release Code → Next.

## If it still does nothing after publishing

Then it is not a deployment issue and the next step is a live diagnosis rather than more edits:

- Confirm `ZNFA_RELEASE_GET_API` is active in SAP API Settings for the environment the live site points at, and that its middleware/proxy settings match the deployed middleware.
- Check the SAP call log for that request to see whether the call left the app at all.
- If the Next button is disabled, the Release Code dropdown was empty — that means no `NFA_KEYS` came back in the login response for the plants selected in the top bar.

No code changes are proposed in this plan; the code is already correct and only needs to be deployed.
