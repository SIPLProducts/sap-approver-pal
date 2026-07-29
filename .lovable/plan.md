## Problem

SAP returned `{"type":"S","mat_doc":"5000432747","doc_year":2026,"message":"Material document posted successfully"}` (lowercase keys), but `postMigo` in `src/lib/mm/migo-release.functions.ts` only reads uppercase `TYPE`/`MESSAGE`/`MAT_DOC`/`DOC_YEAR`. Result: `type === ""`, `ok = false`, popup shows "Failed / SAP returned 200".

## Fix

In `src/lib/mm/migo-release.functions.ts` (`postMigo` handler, ~line 556-575), make key lookup case-insensitive by falling back to lowercase variants:

- `type` = `rawResp.TYPE ?? rawResp.type`
- `message` = `rawResp.MESSAGE ?? rawResp.message`
- `mat_doc` = `rawResp.MAT_DOC ?? rawResp.mat_doc`
- `doc_year` = `rawResp.DOC_YEAR ?? rawResp.doc_year`

Success condition unchanged (`res.ok && type.toUpperCase() === "S"`).

In `src/routes/_authenticated/mm.migo-release.tsx`, the SweetAlert already shows only `res.message` — no key names — so no change needed there. It will now display the exact SAP `message` text ("Material document posted successfully" or the failure message) verbatim.

No business logic changes; only response key mapping is broadened.
