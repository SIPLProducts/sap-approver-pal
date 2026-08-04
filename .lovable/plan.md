# ZNFA Display — show the real SAP MSG instead of "Unexpected response from SAP"

## What is actually happening (confirmed)

The middleware receives the correct SAP body:

```json
{"STATUS":"FALSE","MSG":"PR Data Not Available, Please Check RFQs", ...}
```

but before returning it to the app, `/sap/invoke` runs the configured response-field mapping (`mapSapResponse`). The `ZNFA_DISPLAY_GET_API` config has response fields such as `PR_DET[].BANFN`, `RECOMMEND[].LIFNR`, `ATTACH[].VENDOR`. Because none of them start with `[].`, the mapper treats the response as a flat object and rebuilds it with **only** the mapped target columns. `STATUS` and `MSG` are not mapped fields, so they are dropped.

The app therefore receives an object with no `STATUS` and no `MSG`, falls into its last branch, and prints the generic text `Unexpected response from SAP`.

## Fix (app-side only, no middleware redeploy)

The middleware `/sap/invoke` already accepts a `raw: true` flag that skips mapping and returns the untouched SAP JSON.

1. `src/lib/mm/znfa-display.functions.ts`
   - Send `{ configId, inputs, raw: true }` in the proxy request body so the exact SAP object (including `STATUS` and `MSG`) reaches the server function.
   - Add a defensive fallback when reading the payload: also accept lower-case keys (`status` / `msg`) in case an older middleware build is still deployed, so the exact message is still shown.
   - Keep the existing rule: on `STATUS: "FALSE"`, `sapMessage` is exactly `MSG` trimmed, with no added or default text.

2. `src/lib/mm/znfa-release.functions.ts`
   - Apply the same `raw: true` flag so a `STATUS: "FALSE"` release response also surfaces the exact `MSG` rather than being flattened.

No UI changes are needed — the alert already renders `sapMessage` verbatim.

## Outcome

```text
Could not load the NFA document
PR Data Not Available, Please Check RFQs
```
