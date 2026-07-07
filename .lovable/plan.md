## Goal

Hide the "User ID" input field on the three approval screens and their three report screens. The logged-in user's SAP id must continue to be sent as `USER_ID` in every SAP payload (both fetch and approve/reject).

## Why this is safe

All six server functions already resolve `USER_ID` with this precedence:
`data.user_id (if non-empty) → profiles.sap_user_id (from the authenticated session) → config default`.

So by simply removing the UI input and passing an empty `user_id` from the client, the payload will automatically use the logged-in profile's `sap_user_id`. No server-side changes needed.

## Changes (UI only)

For each file below: remove the `User ID` `<Label>` + `<Input>` block from the filters grid, remove the `userId` `useState`, and pass `user_id: ""` (or drop the property where the type allows) so the server fallback kicks in.

1. `src/routes/_authenticated/sd.contract.tsx` — Contract Approvals
2. `src/routes/_authenticated/sd.contract-reports.tsx` — Contract Approval Reports
3. `src/routes/_authenticated/sd.sc-so.tsx` — Service Certificate & SO Approvals
4. `src/routes/_authenticated/sd.sc-so-reports.tsx` — Service Certificate & SO Approval Reports
5. `src/routes/_authenticated/sd.sales-order.tsx` — Sales Order Approvals
6. `src/routes/_authenticated/sd.sales-order-reports.tsx` — Sales Order Approval Reports

On approval screens (sd.contract, sd.sc-so, sd.sales-order), both the Fetch call and the Approve/Reject decision call currently pass `userId.trim()` — both will be replaced with `""` so the server uses the profile's SAP id.

Grid column count (`grid-cols-…`) will be adjusted where needed after removing the User ID cell so remaining filters stay aligned.

## Out of scope

- No changes to server functions (`*.functions.ts`) — fallback already exists.
- No changes to SAP API config, endpoints, or auth.
- No changes to reports column rendering.

## Verification

- `tsgo` typecheck.
- Open each of the 6 screens: User ID field is gone.
- Run Execute / Approve / Reject; network payload shows `USER_ID` populated with the logged-in user's SAP id.
