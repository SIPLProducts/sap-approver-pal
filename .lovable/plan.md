## Problem

The MIGO Release screen errors with `SAP API config "MIGO_FETCH_API" not found`, and no payload reaches the middleware.

Root cause (verified via DB): the SAP API config is stored as **`MIGO_Fetch_API`** (mixed case), but `src/lib/mm/migo-release.functions.ts` looks up `MIGO_FETCH_API` with an exact-match query. This is the same case-sensitivity issue we hit before with `PO_REJECT_API`.

## Fix

In `src/lib/mm/migo-release.functions.ts`, change the config name constants from `MIGO_FETCH_API` / `MIGO_SAVE_API` to match what's actually configured:
- `MIGO_FETCH_API` → `MIGO_Fetch_API`
- `MIGO_SAVE_API` → `MIGO_Save_API` (will confirm exact save-config name; if the user hasn't created it yet, we'll leave the string but note it must be added)

No UI, business logic, or middleware changes.