## Replace USER_ID From/To with single optional User ID

### Problem
The Contract Approvals screen currently has two mandatory USER_ID fields (From / To). The user wants a single optional "User ID" field instead.

### Changes

#### 1. UI (`src/routes/_authenticated/sd.contract.tsx`)
- Replace `userIdFrom` + `userIdTo` state with a single `userId` state.
- Replace the two "USER_ID From / To" inputs with one "User ID" input (optional, no red asterisk).
- Remove USER_ID from the `execute()` validation (only Plant remains required).
- Update `mutation.mutate()` payload to send a single `user_id` string.
- Update `canExecute` to only depend on `plant.trim()`.
- Update the responsive grid from `lg:grid-cols-6` to `lg:grid-cols-5` since one field is removed.
- Update the empty-state helper text to say "Enter Plant and click Execute...".

#### 2. Server function (`src/lib/sd/contract-approval.functions.ts`)
- In `inputValidator`: replace `user_id_from` (required) and `user_id_to` (optional) with a single optional `user_id` string.
- In handler: read `data.user_id` instead of `data.user_id_from`. If blank, pass empty string to SAP for `USER_ID`.
- No changes to SAP request/response mapping, table columns, status radio, or Customer From/To logic.

### Out of scope
- Table columns, scroll behaviour, status radio, Customer From/To, SAP API config.

### Files
- `src/routes/_authenticated/sd.contract.tsx`
- `src/lib/sd/contract-approval.functions.ts`