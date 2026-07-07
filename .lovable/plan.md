## Goal

Ensure `USER_ID` in the SAP `Sales_Approval_Fetch` payload always contains the logged-in user's SAP user id, matching how the approve/reject calls already resolve it. Apply the same fix to the sibling SD fetches (Contract, SC/SO) for consistency, since they share the exact same bug.

Price fetch already resolves USER_ID from the profile — no change there. BMW status has no USER_ID field — no change.

## Changes

### 1. `src/lib/sd/sales-order-approval.functions.ts` — `fetchSalesOrderApprovals` handler

Replace the current line:

```ts
const userId = (data.user_id ?? "").trim();
```

with the same resolution chain already used by `submitSalesOrderDecision`:

- Load in parallel with the existing config/creds/globals fetch:
  - `profiles.sap_user_id` for `context.userId`
  - `sap_api_request_fields.default_value` where `field_name = "USER_ID"` for this config
- Resolve:

```ts
const userId =
  (data.user_id && data.user_id.trim()) ||
  (prof?.sap_user_id && prof.sap_user_id.trim()) ||
  (userIdField?.default_value as string | null) ||
  "";
```

Feed `userId` into the existing `inputs.USER_ID`. No changes to proxy/direct branches, query string, or response shape.

### 2. `src/lib/sd/contract-approval.functions.ts` — `fetchContractApprovals` handler

Same change: swap the direct `(data.user_id ?? "").trim()` for the profile-first resolution chain (mirroring `submitContractDecision` in the same file).

### 3. `src/lib/sd/sc-so-approval.functions.ts` — `fetchScSoApprovals` handler

Same change on `USER_ID: (data.user_id ?? "").trim()` (mirroring the decision handler in the same file).

## Out of scope

- No UI changes. The "User ID" input on the SD screens keeps working as an optional override — when the user leaves it blank, the server now fills it from their profile automatically.
- No changes to price fetch, BMW status, decision handlers, request/response shapes, or auth flow.
- No column/table changes.

## Verification

- `tsgo` typecheck.
- Manually inspect the outgoing payload in the SAP sync log / server function log after one Execute click with the User ID field left blank — `USER_ID` should equal the caller's `profiles.sap_user_id`.
