# Gate Pass Execute — TYPE: "E" popup handling

## Goal
In the Gate Pass screen, when Execute is clicked and the SAP API response contains `TYPE: "E"`, show only the exact `MESSAGE` value in a popup and leave the results table empty. Keep all existing code, logic, and functionality unchanged.

## Current state
- `src/lib/mm/gate-pass.functions.ts` (`fetchGatePass`) parses the SAP response into `header`/`data` but does not inspect a `TYPE` field. A `TYPE: "E"` payload would still populate rows and not surface the error clearly.
- `src/routes/_authenticated/mm.gate-pass.tsx` already has a `responseDialog` used for the Save response, but Execute errors are currently shown via `toast.error`.
- The helper `src/lib/mm/sap-message.ts` already exports `findFirstDeep` and `extractSapMessage`, which PR Release uses for the same `TYPE: "E"` handling.

## Changes

### 1. Server function — detect `TYPE: "E"`
File: `src/lib/mm/gate-pass.functions.ts`

After parsing `sapJson` and before mapping `headerArr`/`dataArr`:
- Import `findFirstDeep` and `extractSapMessage` from `src/lib/mm/sap-message.ts`.
- Read the first `TYPE` value anywhere in the response using `findFirstDeep(sapJson, ["TYPE"])`.
- If it is a string and `trim().toUpperCase() === "E"`:
  - Extract the exact message with `extractSapMessage(sapJson)`.
  - Insert a `sap_api_sync_log` row with status `"error"` and the message.
  - Return `{ header: null, data: [], fetched_at, user_id, error: exactMessage }`.
  - Do not return any header or rows.
- If `TYPE: "E"` is not found, keep the existing row/header mapping unchanged.

### 2. Component — show Execute errors in the popup
File: `src/routes/_authenticated/mm.gate-pass.tsx`

In the `mutation.onSuccess` handler:
- Keep `setHeader(res.header)` and `setRows(res.data)` exactly as they are (the function already returns empty data for errors).
- When `res.error` is present, open the existing `responseDialog` with:
  - `title: "Gate Pass Response"`
  - `results: [{ label: "Gate Pass", message: res.error, ok: false }]`
- When there is no error, keep the existing `toast.success(...)` behavior.
- Do not change the success path, the Save response dialog, or any other logic.

## Verification
- `bun run build:dev` passes.
- The Gate Pass Execute flow returns an empty table and opens the response dialog when `TYPE: "E"` is returned.
- No other screens or functionality are modified.
