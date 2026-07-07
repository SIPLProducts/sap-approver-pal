## Goal

Bind the logged-in user's SAP user ID into the USER_ID field of the Contract Approvals payload by default (both interactive and reports screens), so the fetch payload carries the correct user without the operator typing it. User remains free to edit or clear the field.

## Changes

### 1. `src/routes/_authenticated/sd.contract.tsx`
- Import `useSapProfile` from `@/hooks/use-sap-profile`.
- Read `profile?.user` and seed `userId` state from it via a `useEffect` (only when the input is still empty, so we don't stomp what the user types).

### 2. `src/routes/_authenticated/sd.contract-reports.tsx`
- Same treatment: seed the `userId` state from `useSapProfile().user` on mount / when it becomes available, only if the field is empty.
- Update the placeholder from `"optional"` to `"defaults to your SAP user"`.

## Out of scope

- No changes to `fetchContractApprovals` server function; payload shape stays exactly as it is today (the payload the user pasted is already correct — USER_ID is being sent). The only change is client-side auto-population so operators don't have to type it.
- No changes to Reports for other modules (SO, SC/SO, Price) — this request is scoped to Contract Approvals.
- No change to how SAP filters records; if SAP returns 0 rows for a specific USER_ID that's a SAP-side data/authorization matter and is not addressed here.

## Verification

- Load `/sd/contract` and `/sd/contract-reports` with a logged-in SAP profile → USER_ID input pre-fills with the profile's SAP user; clicking Execute sends that value.
- Manually typing a different USER_ID overrides the default and is preserved.
- Clearing the input and executing sends `USER_ID: ""`.
