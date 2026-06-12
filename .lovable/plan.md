## Goal
Make the `USER_ID` field on the Price Approvals selection screen editable so the user can type/override the SAP user ID instead of it being locked to the auto-fetched value.

## Changes (frontend only — `src/routes/_authenticated/sd.price.tsx`)

1. Add local state `const [userId, setUserId] = useState("")`.
2. When `userIdData?.sap_user_id` loads (via a `useEffect`), prefill `userId` only if the field is still empty (so user edits aren't overwritten).
3. Update the `USER_ID` `<Input>`:
   - Remove `readOnly` and the muted background.
   - Bind `value={userId}` and `onChange={(e) => setUserId(e.target.value)}`.
   - Add `placeholder="SAP USER_ID"` and keep `font-mono h-9`.
4. Pass `userId` to the fetch call in `execute()` — extend `mutation.mutationFn` and `fetchPriceApprovals` payload to include `user_id` (trimmed). If the server function currently ignores it, it still does no harm; if it accepts it, it overrides the default.
5. Reset: clear `userId` back to the fetched default in `reset()`.

## Out of scope
- No backend / server-function signature changes unless `fetchPriceApprovals` already accepts `user_id`. If it doesn't, I'll add an optional `user_id` to its input validator and forward it to the SAP call — confirm before I touch the server function.

## Question
Should the entered `USER_ID` actually be sent to SAP for the fetch/decision calls, or is it display-only (informational) for now?
