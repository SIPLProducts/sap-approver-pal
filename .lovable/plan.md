# Gate Pass Save — exact error popup for STATUS: FALSE / TYPE: "E", never treat as saved

## Goal
On Gate Pass Save, if the SAP/middleware response is a failure — `STATUS: "FALSE"` or `TYPE: "E"` in any shape (e.g. `{"MESSAGES":[{"TYPE":"E","MESSAGE":"Please maintain remarks"}]}`) — show only the exact SAP message text in the Swal popup and do NOT treat the rows as saved (no selection clear, no list refresh).

## Verified current state
- `src/lib/mm/gate-pass.functions.ts` (`saveGatePass`) already extracts errors in order: `MESSAGES` array → `TYPE:"E"`/`MSG` envelope → `STATUS:"FALSE"` (MESSAGE-preferred) → collected messages → legacy `TYPE`/`MESSAGE` shape, and returns `{ ok: false, error, messages }`.
- `src/routes/_authenticated/mm.gate-pass.tsx` `saveMutation.onSuccess` already returns early on `!res.ok` with a message-only popup — selection is kept and no refetch happens (rows are not treated as saved).
- Two gaps remain:
  1. The `collected.length > 0` branch (line ~459) sets `ok: res.ok` — if the HTTP status is 200 but the collected messages contain `TYPE: "E"`/`"A"` entries that the earlier extractors missed (wrapper shapes), it returns `ok: true` and the screen shows success, clears selection and refreshes.
  2. The UI error path shows only `res.error ?? res.message` — when `res.messages` carries several entries, only the first is displayed.

## Changes

### 1. Server — never return ok when any message is an error
File: `src/lib/mm/gate-pass.functions.ts` (`saveGatePass`)

In the `collected.length > 0` branch only:
- Detect `hasError = collected.some(m => ["E","A"].includes(m.type.trim().toUpperCase()))`.
- If `hasError` (or `!res.ok`): return `ok: false`, `error` = exact text of the first E/A entry (or joined messages), and `messages: collected` unchanged. Log as `error`.
- Otherwise keep the existing success return exactly as-is.

All other branches (extractMessagesArrayError / TYPE-E / STATUS-FALSE / legacy) already return `ok: false` with the exact text — leave untouched.

### 2. UI — show every returned message on failure
File: `src/routes/_authenticated/mm.gate-pass.tsx`

In `saveMutation.onSuccess`, the `!res.ok` branch:
- If `res.messages` is non-empty, map each entry to its own popup row (`message` verbatim, `ok: false` for E/A) with `messageOnly: true`.
- Otherwise keep the current single-message fallback (`res.error ?? res.message`).
- Keep the early return — no `setSelected` clear, no refetch on failure.

## Unchanged
- Save payload, Gate_Pass_Save_API call, middleware, all success handling, logging style, every other MM screen.

## Verification
- `bun run build:dev` passes; existing `sap-message.test.ts` tests pass.
- Add/extend a regression test: `{"MESSAGES":[{"TYPE":"E","MESSAGE":"Please maintain remarks"}]}` yields `ok: false` and exact message `Please maintain remarks`.
