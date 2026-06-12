## Contract Approvals — auto-refetch on status change + Pending Accept/Reject

Mirror the Price Approvals UX in the Contract Approvals screen.

### 1. Auto re-fetch on status change

In `src/routes/_authenticated/sd.contract.tsx`:
- After the first successful Execute, switching the status radio (Pending / Accepted / Rejected) triggers a new SAP fetch automatically with the same Plant / User ID / Customer From / Customer To and the new status flag (`R_PEND` / `R_ACCP` / `R_REJ`).
- If the user has not yet clicked Execute (no plant entered / no prior fetch), changing the radio just updates local state — no fetch.
- Track whether a fetch has happened (e.g. `lastFetchedAt != null`) and call `mutation.mutate(...)` from a small `onStatusChange` handler.
- Clear `selected` set on every fetch and on status change.

### 2. Pending-only checkboxes + Accept / Reject

UI (Pending tab only — Accepted & Rejected tabs render exactly as today, no checkbox column, no action buttons):

- Add a left-most checkbox column to the table header and each row, only when `status === "pending"`.
- Header checkbox is select-all / deselect-all for the currently visible rows (with indeterminate state when partially selected).
- Add "Accept" (green) and "Reject" (destructive) buttons in the table header bar on the right, only when `status === "pending"`. Disabled when no row is selected or while the decision mutation is in flight. Show a spinner on the active button.
- Selected-row highlight (`bg-accent/30`) and a "· N selected" counter in the header, matching Price Approvals.
- Reuse the same `ResultDialog` UX pattern as Price Approvals to show SAP messages after submit; on success, re-fetch the Pending list so accepted/rejected rows drop out.

Row identity key for the selection `Set<string>`:
`contract_no | contract_item | customer | material | index`.

### 3. Server function — new `submitContractDecision`

New export in `src/lib/sd/contract-approval.functions.ts` (same shape as `submitPriceDecision`):

- `inputValidator`: `{ action: "accepted" | "rejected", rows: ContractRow[] (min 1) }`.
- Reads SAP API config `Contract_Approve_Reject` from `sap_api_configs` (default; if not present the function throws a clear "Configure it in Admin → SAP API" error — matches Price pattern).
- Builds SAP payload mirroring Price's flag convention:
  ```
  {
    APPROV: action === "accepted" ? "X" : "",
    REJ:    action === "rejected" ? "X" : "",
    DATA:   rows.map(toSapContractRow)   // SELECT_FLG: "X" + all CONTRACT_* fields as strings
  }
  ```
- Proxy vs direct call, headers, x-shared-secret, basic auth, `/sap/invoke` 404 fallback, `sap_api_sync_log` insert — all copied 1:1 from `submitPriceDecision`.
- Returns `{ ok, action, count, sap_response }`.

Field mapping for `toSapContractRow` covers every column already on `ContractRow` (CUSTOMER zero-padded to 10 digits like Price does, all other values stringified, empty for null).

### Out of scope
- SAP `Contract_Approve_Reject` config row itself — assumed to exist (or to be created in Admin → SAP API). The fetch logic, table columns, Customer From/To, and single User ID field are unchanged.

### Files
- `src/routes/_authenticated/sd.contract.tsx` — auto-refetch on radio change, pending-only checkbox column + select-all, Accept/Reject buttons, ResultDialog, decision mutation wiring.
- `src/lib/sd/contract-approval.functions.ts` — add `submitContractDecision` server function + `toSapContractRow` helper.
