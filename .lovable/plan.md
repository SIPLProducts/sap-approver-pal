## PR Release — Multiple Level: live SAP fetch + results table

Scope: only the "Multiple Level" branch of `/_authenticated/mm/pr-release`. Single Level remains a placeholder.

### 1. New server function
Create `src/lib/mm/pr-release.functions.ts` mirroring `gate-pass.functions.ts`:

- Config name: `PR_Release_Multiple_Fetch_API`.
- Input (zod): `{ relgroup: string (1..10), relcode: string (1..10) }`.
- Payload sent to SAP / proxy: `{ RELGROUP, RELCODE }`.
- Reuse the same proxy vs direct dispatch logic (global `connection_mode`, `middleware_url`, `x-shared-secret`, basic auth fallback) already used by Gate Pass / Material Reservation.
- Response parsing: accept a raw array (as shown in the sample), or `{ DATA: [...] }` / `{ data: [...] }` envelopes. Return `{ data: rows, fetched_at, error }`.
- Log to `sap_api_sync_log` on success/error like the Gate Pass function does.

No changes to any other MM function.

### 2. UI: `src/routes/_authenticated/mm.pr-release.tsx`
Keep the current selection card (radios + Release Group + Release Code + Execute/Reset). Add multiple-level behavior:

- On Execute when `level === "multiple"`:
  - Validate `releaseGroup` and `releaseCode` non-empty; else toast error.
  - Call `fetchPrReleaseMultiple` via `useServerFn` inside a `useMutation` (pattern used in gate-pass/material-reservation screens).
  - Show a loading state on the Execute button.
- On Execute when `level === "single"`: keep the existing placeholder toast (no API yet).
- Below the selection card, when multiple-level results exist, render a results Card containing:
  - A table (plain shadcn `Table`, matching existing MM screens' inline tables — not the Cloudscape approval table) with:
    - First column: header checkbox (select all visible) + per-row checkboxes for selection.
    - Columns derived from the response keys, in the order they appear in the sample: `PREQ_NO, PREQ_ITEM, DOC_TYPE, PUR_GROUP, CREATED_BY, PREQ_NAME, PREQ_DATE, SHORT_TEXT, MATERIAL, PLANT, QUANTITY, UNIT, DELIV_DATE, DES_VENDOR, FIXED_VEND, PURCH_ORG, CURRENCY, PO_PRICE, C_AMT_BAPI`. (Curated visible subset — full row object kept in state so future actions can send all fields. Non-visible keys still round-trip.)
    - Row key: `${PREQ_NO}-${PREQ_ITEM}`.
  - Empty state row when the API returns `[]`.
- Below the table, two action buttons styled like the Contract Approvals footer (primary + destructive):
  - `Release` (primary; renamed from "Accept"): disabled until at least one row is selected; on click just toast `"Release: N item(s)"` for now (no release API specified yet — hookable later).
  - `Reject` (destructive/outline): same disabled rule; on click toast `"Reject: N item(s)"`.
- Reset button also clears results + selection.

### 3. No other changes
- No sidebar/permission/screen-key changes (PR Release already exists under MM Approvals gating).
- No changes to Single Level flow, other MM screens, middleware, or SAP config rows.
- SAP config `PR_Release_Multiple_Fetch_API` is assumed already configured in Admin → SAP API (same convention as Gate Pass / ZNFA / Material Reservation). If missing, the server function surfaces a clear "config not found" error, matching sibling screens.

### Technical notes
- Server fn shape: `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(...).handler(...)` — top-level `supabaseAdmin` import forbidden in `*.functions.ts`; import inside handler.
- Response robustness: `Array.isArray(json) ? json : json?.DATA ?? json?.data ?? []`; also unwrap proxy `{ data: ... }` envelope like Gate Pass does.
- Selection state: `Set<string>` of composite row keys; header checkbox toggles all currently displayed rows.
