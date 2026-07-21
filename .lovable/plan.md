## Root cause

The Reject action never reaches the middleware because rows with an empty `PREQ_ITEM` are silently dropped before the server function is called.

Confirmed:
- `PR_Reject_API` exists in `sap_api_configs`, `is_active=true`, method `POST`, endpoint `/mm_approve_mng/pr_rel/release?sap-client=300` — so config isn't the blocker.
- User's own example payload uses `"BNFPO": ""` (header-level reject).
- In `src/routes/_authenticated/mm.pr-release.tsx` `onReject`, items are filtered with `it.PREQ_NO && it.PREQ_ITEM` — any row without a PR item is discarded, `items.length === 0` returns early, no toast, no server call.
- Even if that filter passed, the shared `prActionInput` Zod validator in `src/lib/mm/pr-release.functions.ts` requires `PREQ_ITEM: z.string().trim().min(1)` and would reject the same payload with a validation error before `fetch`.

Net effect: clicking Reject on such rows is a no-op — nothing hits `/sap/invoke`, matching "payload is not reaching the middleware."

## Fix (UI + server function only, no middleware changes)

1. `src/routes/_authenticated/mm.pr-release.tsx` — in `onReject`, drop the `it.PREQ_ITEM` requirement from the filter (keep the `PREQ_NO` requirement). Do not touch `onRelease`.
2. `src/lib/mm/pr-release.functions.ts` — split the input schema so Reject allows empty `PREQ_ITEM`:
   - Keep `prActionInput` (min 1) for `releasePrItems`.
   - Add `prRejectInput` identical to it but with `PREQ_ITEM: z.string().trim().default("")` and use it in `rejectPrItems.inputValidator`.
   - `processPrAction` already forwards `PREQ_ITEM` verbatim into `BNFPO`, so empty string flows through unchanged.
3. If nothing is selected or `PREQ_NO` is missing, keep current silent no-op behavior (existing Release parity).

## Out of scope

- No middleware changes.
- No changes to Release logic, response parsing, config lookup, or table refresh.
- No changes to column labels or unrelated screens.
