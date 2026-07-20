## Release action for PR Release screen

Wire the "Release" button on `src/routes/_authenticated/mm.pr-release.tsx` to call `PR_Release_API` for each checked row, show a per-row toast using SAP's `MSGTXT`, and refresh the pending list.

### 1. New server function — `src/lib/mm/pr-release.functions.ts`

Add `releasePrItems` alongside the existing `fetchPrReleaseMultiple`:

- Config name: `PR_Release_API`.
- Input (zod):
  ```
  { relgroup, relcode, items: [{ PREQ_NO, PREQ_ITEM, REMARKS? }] }
  ```
- For each item, build payload:
  ```
  { RELEASE: { BANFN, BNFPO, REL_CODE: relcode, REL_GRP: relgroup, REMARKS: remarks ?? "" } }
  ```
- Reuse the same SAP invocation pattern as `fetchPrReleaseMultiple` (proxy vs direct, credentials, headers, `sap_api_sync_log` entry). Send one HTTP call per row sequentially so each row's `MSGTXT` is captured independently.
- Return `{ results: [{ preq_no, preq_item, ok, msgtxt, error? }], error? }` — no throw on partial failures; only throw for missing/disabled config.

### 2. UI wiring — `src/routes/_authenticated/mm.pr-release.tsx`

- Add a `releaseMutation` using `useServerFn(releasePrItems)`.
- `onRelease` handler:
  1. Guard: require `releaseGroup` + `releaseCode` + at least one checked row.
  2. Build `items` from `rows` filtered by `selected`, using `remarks[k] ?? r.REMARKS ?? ""`.
  3. Call the server fn.
  4. On response, iterate `results`: `toast.success` when `ok`, `toast.error` otherwise, using `MSGTXT` as the message (fallback: `error` or a generic string). Prefix each toast with `PR <BANFN>/<BNFPO>` so multiple toasts are distinguishable.
  5. After all toasts, re-run the existing `fetchPrReleaseMultiple` mutation with the current `releaseGroup`/`releaseCode` so released rows disappear from the pending list. Clear `selected` and `remarks` on refresh (already handled by `onSuccess`).
- Disable the Release button while `releaseMutation.isPending` (spinner like Execute).
- Reject button behavior is unchanged.
- No auto-call on row click or checkbox toggle — API only fires from the Release button.

### 3. Out of scope

- No schema changes, no changes to `fetchPrReleaseMultiple`, no changes to Reject behavior, no changes to column labels, and no seeding of the `PR_Release_API` config (must already exist in `sap_api_configs`, same as sibling configs).
