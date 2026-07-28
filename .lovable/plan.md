## MIGO Release — Check button + Custom Fields card

### Behavior
- **Check button**: disabled by default. Enabled only after a successful `Get Details` load (i.e., when header/data have been populated without error). Apply a distinct background (e.g., amber/warning tone via Tailwind classes like `bg-amber-500 hover:bg-amber-600 text-white`) to visually differentiate from Get Details.
- Clicking **Check** calls the new SAP config `MIGO_Check_API` with payload:
  ```json
  { "mblnr": "<matDocNo>", "mjahr": "<matDocYear>", "Check": "X" }
  ```
- Response is an array of objects. Take the first row and store it as `customFields`.
- Show toast on success/error like other actions.

### UI — new Custom Fields card
- Placed **below the HEADER card** and **above the Items table** in `src/routes/_authenticated/mm.migo-release.tsx`.
- Same visual pattern as HEADER card: `Card` with a title row ("CUSTOM FIELDS") and a responsive grid of read-only `<Input>` fields.
- Fields rendered (in this order): `GAT_NO`, `GAT_DATE`, `GIR_NO`, `GIR_DATE`, `VEHICLE_NO`, `INVOICE_NO`, `TRANSPORT_NO`, `ZINSP`, `ZNSP`, `ZMTSNR`. Labels are prettified (underscores → spaces).
- Card is only rendered after Check has returned data. Existing HEADER card and Items table remain unchanged.

### Server function
- Add `checkMigo` in `src/lib/mm/migo-release.functions.ts` mirroring `fetchMigo` structure but using `CHECK_CONFIG_NAME = "MIGO_Check_API"`.
- Input: `{ mat_doc_number, mat_doc_year }`. Payload built as `{ mblnr, mjahr, Check: "X" }`.
- Reuse the same proxy/direct/basic-auth/logging code path as `fetchMigo`.
- Return `{ fields: Record<string, any> | null, raw: any[], error: string | null }` where `fields` is the first row of the SAP array response (supports `DATA`, `data`, or top-level array).

### Route wiring (`mm.migo-release.tsx`)
- Add state `customFields: Record<string, any> | null` and reset it in `reset()` and at the start of a new `execute()`.
- `check()` handler: validate inputs, call `checkMigo` via `useServerFn` + `useMutation`; on success set `customFields`.
- `Check` button `disabled = !hasResults || checkMutation.isPending`, with the distinct background classes.
- Render the Custom Fields card between HEADER card and the Save/Items table block when `customFields` is present.

### Out of scope
- No changes to Get Details behavior, Items table, Save logic, or the HEADER card.
- No DB migration (config row is expected to be created by the user in Admin → SAP API, matching prior pattern for MIGO_Fetch/Save).