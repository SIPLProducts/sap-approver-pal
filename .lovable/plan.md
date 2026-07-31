## Goal
In ZNFA Rating, the Rating column dropdown should use fixed values T1–T10 and NQ instead of the SAP F4 API.

## Changes (src/routes/_authenticated/mm.gate-process.tsx)
- Add a module-level constant `RATING_OPTIONS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","NQ"]`.
- Remove the `fetchZnfaRatingF4` import, the `ratingF4Fn` server-fn hook, and the `useQuery` that loads F4 options; drop the derived `ratingOptions` variable.
- Point the Rate cell dropdown at `RATING_OPTIONS`, and remove the now-dead "no options → plain input" fallback. Read-only (non-editable) rendering stays exactly as-is, so the dropdown still only appears after a row is selected and Rating/Change is clicked.

Save, payload shape, and all other behavior stay unchanged.

## Not touched
`fetchZnfaRatingF4` in `src/lib/mm/gate-process.functions.ts` is left in place (unused) unless you want it deleted too — say the word and I'll remove the server function as well.