# Fix "Array must contain at most 50/200 elements" on Create User

## What is happening

The Create User request is rejected before it ever reaches SAP. The app's input
checks currently allow at most 50 plants and 200 plant-role assignments. Your
selection has 426 plants and 3500+ role rows, so both checks fail and you see the
raw validation error instead of a result.

## What changes

Raise the caps on every user-management call that carries plants or roles, so
large real-world selections pass:

- Create User (SAP): plants up to 5,000; plant-role assignments up to 50,000.
- Get roles for selected plants: plants up to 5,000.
- Legacy create/update user helpers: plants up to 5,000; roles up to 5,000.

No change to what is sent to SAP, no change to screens, no change to behaviour
for small selections. Duplicate plants are still de-duplicated as today.

## Technical details

In `src/lib/admin/user-mgmt.functions.ts` only, adjust the Zod validators:

- `createSapUser`: `plants ... .min(1).max(5000)`, `roles ... .min(1).max(50000)`.
- `listRolesForPlants`: `plants ... .min(1).max(5000)`.
- `createUserWithRoles` (line ~66/67) and `createUser`/update helper (line ~155):
  `plants ... .max(5000)`, `roles ... .max(5000)`.

Handlers are unchanged; they already de-duplicate and map arrays without
per-item limits.

## Note

A 3,500-item ROLES array in one SAP call can be slow or hit SAP/middleware
limits. If the request times out after this change, the next step would be to
send role assignments in chunks (e.g. 500 per call) — say the word and I will
plan that separately.
