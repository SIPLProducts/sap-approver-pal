# PR Release — send logged-in User ID dynamically in the GET PR payload

## What changes for the user

- Every time PR Release fetches from SAP (Execute, and the automatic refreshes after Release / Reject / Undo actions), the request carries **your own signed-in User ID** in `USER_ID` — never a fixed or typed-in value.
- Nothing else changes: filters, Cancel Record checkbox, buttons, popups, and pagination behave exactly as today.

## Verified current state

- `mm.pr-release.tsx` already derives the ID from the signed-in SAP session (`useSapProfile()` → `sapProfile?.user`) and passes it as `user_id` on all five `fetchPrReleaseMultiple` calls (Execute at line 242, post-release 332, post-undo-release 400, post-undo-reject 464, post-reject 528).
- `fetchPrReleaseMultiple` in `src/lib/mm/pr-release.functions.ts` already accepts `user_id` and puts `USER_ID` into the per-plant SAP inputs (line 73), alongside `CANCEL_REC`.

## Remaining gap to close

- If the SAP profile is missing or has no `user` value (expired/corrupted local session), `USER_ID` is silently sent as `""`. Fix: fall back to the signed-in account's identity so `USER_ID` is always populated from the current session — never hardcoded.
- Add a light guard: when no User ID can be resolved from the session at all, Execute shows the standard message popup ("Could not determine the signed-in SAP user. Please sign in again.") instead of sending an empty `USER_ID`.

## Technical changes

1. `src/routes/_authenticated/mm.pr-release.tsx` — resolve `sapUserId` from `useSapProfile()` first, then fall back to the authenticated user's login identity (the same identifier captured at SAP login); reuse one resolved value for all five mutate calls. Add the guard in the Execute handler.
2. No changes to `pr-release.functions.ts` (validator and `USER_ID` input already exist), no changes to any other screen, API config, validation, or UI.

## Verification

- Typecheck, then a preview pass on PR Release: Execute with and without Cancel Record confirms `USER_ID` carries the signed-in user's ID in the request, and normal Release/Reject flows are untouched.
