## Problem
On the Price Approval screen, clicking Accept (or Reject) sends a payload to SAP's `Price_Approve_Reject` API without `USER_ID`. The current handler builds:
```
{ APPROV, REJ, DATA: [...] }
```
SAP expects `USER_ID` too (it's configured in `sap_api_request_fields` for that config).

## Fix

**1. `src/lib/sd/price-approval.functions.ts` — `submitPriceDecision`**
- Extend `inputValidator` to accept an optional `user_id` from the client.
- Resolve `USER_ID` server-side using the same precedence used by `fetchPriceApprovals`:
  1. `data.user_id` (typed in UI)
  2. profile `sap_user_id`
  3. `sap_api_request_fields.default_value` for `USER_ID` on the `Price_Approve_Reject` config
  4. fallback `"NEOBMWCONS"`
- Add `USER_ID: resolvedUserId` to `sapPayload` (top-level, alongside `APPROV`/`REJ`/`DATA`).

**2. `src/routes/_authenticated/sd.price.tsx` — `decide()` / `decisionMutation`**
- Pass the current `userId` state from the toolbar through:
  - `mutationFn` vars get `user_id: string`
  - `decide(action)` includes `user_id: userId.trim()` in `mutate(...)`

No DB/migration changes. No UI changes beyond wiring the existing `userId` input through.

## Verification
After fix, clicking Accept logs payload `{ APPROV: "X", REJ: "", USER_ID: "<entered or profile value>", DATA: [...] }` and the SAP middleware request body shows the dynamic USER_ID.
