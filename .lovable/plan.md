# Gate Pass Save — exact MESSAGE from MESSAGES array

## Goal
When the Gate Pass Save API returns `{ MESSAGES: [{ TYPE: "E", MESSAGE: "Please maintain remarks" }] }`, show only the exact `MESSAGE` value in the popup and nothing else from the response.

## Current state
- `src/lib/mm/gate-pass.functions.ts` (`saveGatePass`) already extracts `MESSAGES` array errors via `extractMessagesArrayError` and returns them in the `messages` array.
- `src/routes/_authenticated/mm.gate-pass.tsx` already maps those messages into the shared `SapResponseDialog` popup.
- `src/lib/mm/sap-message.test.ts` covers a similar Material Reservation case but not the Gate Pass example.

## Changes
1. Add a focused regression test in `src/lib/mm/sap-message.test.ts` asserting that the exact Gate Pass example payload returns `Please maintain remarks`.
2. Verify that the popup single-message view renders only the message text and does not append document numbers or raw response data.
3. If the message extraction is missed for any middleware wrapper shape, adjust only the extraction step in `src/lib/mm/sap-message.ts`; otherwise leave existing code unchanged.

## Verification
- `bun run build:dev` passes.
- The new regression test for the exact example payload passes.
- No other MM screen behavior is changed.
