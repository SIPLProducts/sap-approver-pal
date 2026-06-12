# Contract Approvals — Live SAP Fetch

Rewrite `src/routes/_authenticated/sd.contract.tsx` to mirror the Price Approvals pattern: live SAP fetch via the configured `Contract_Approval_Fetch` API, mandatory Plant, USER_ID From/To inputs, and status radios driving the SAP `R_PEND / R_ACCP / R_REJ` flags. The old DB-backed `SdApprovalShell` tabs are removed for this screen.

## Selection Screen

- **Plant** — mandatory text input (`*`). Execute disabled until filled. Prefilled from request-field default (`3801`) if available.
- **USER_ID From** — mandatory text input. Prefilled from profile `sap_user_id` or request-field default (`NEOBMWCONS1`).
- **USER_ID To** — mandatory text input. Defaults to same value as From.
- **Status** (radio group, exactly one selected, mandatory, default Pending):
  - Pending → `R_PEND="X"`, others blank
  - Accepted → `R_ACCP="X"`, others blank
  - Rejected → `R_REJ="X"`, others blank
- **Execute** — calls the new server function. **Reset** — clears inputs and rows.
- Old `Pending / Accepted / Rejected` tabs removed.

## Output Table

Replace shell table with a flat table bound to the live response. Columns map to the 30 response fields (Customer, Customer Name, Contract No, Con Creation, Material, Qty, Net Value, Tax Value, Total, Agreement From/To, Service Valid From/To, Sales Org, Co. Code, Reason, etc.). Currency-style numbers right-aligned; dates formatted like price screen.

Empty state: "Enter Plant + USER_ID and click Execute". Loading state: spinner. Shows row count + last fetched time.

## New Server Function

Add `fetchContractApprovals` in a new file `src/lib/sd/contract-approval.functions.ts`, modeled on `fetchPriceApprovals`:

- Config name: `Contract_Approval_Fetch`
- Input: `{ plant, user_id_from, user_id_to, status: "pending"|"accepted"|"rejected" }` (zod-validated, plant + user_id_from required)
- Builds query string: `PLANT, CUSTOMER_FROM (empty), CUSTOMER_TO (empty), USER_ID (=user_id_from), R_PEND, R_ACCP, R_REJ`
- Proxy mode: posts to `${middleware}/contract_approval/Fetch` (with `/sap/invoke` fallback on 404), body `{ inputs: { PLANT, CUSTOMER_FROM:"", CUSTOMER_TO:"", USER_ID, R_PEND, R_ACCP, R_REJ } }`
- Direct mode: GET to `cfg.endpoint_url` with the params appended and Basic auth from `sap_api_credentials`
- Unwraps middleware envelope `json.data`, then `DATA[]`, maps each row to a typed `ContractRow` (all 30 fields, case-insensitive pick)
- Logs to `sap_api_sync_log` on success/error; returns `{ rows, fetched_at, count, error }` (never throws on SAP errors — returns friendly `error`)

## Out of Scope

- No changes to `SdApprovalShell` (other SD screens still use it).
- No DB writes — the screen is purely a live SAP viewer for now (no Accept/Reject actions). If you want Accept/Reject like the price screen, that's a follow-up.
- No changes to the `Contract_Approval_Fetch` config or its request/response field definitions.

## Files

- **New**: `src/lib/sd/contract-approval.functions.ts`
- **Rewritten**: `src/routes/_authenticated/sd.contract.tsx` (drops `SdApprovalShell` import, drops `status` search param)
