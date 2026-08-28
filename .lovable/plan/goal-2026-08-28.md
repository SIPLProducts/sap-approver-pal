Gate Pass Save — show exact error message for all SAP failure shapes

## Goal
When the Gate Pass Save API fails with any of these shapes, show only the exact error text in the popup and nothing else:
- `{ MESSAGES: [{ TYPE: "E", MESSAGE: "..." }] }`
- `{ TYPE: "E", MSG: "..." }`
- `{ STATUS: "FALSE", MESSAGE: "..." }` or `{ STATUS: "FALSE", MSGTXT: "..." }`

Example: show only `Please maintain remarks`.

## Current state
- `src/lib/mm/gate-pass.functions.ts` (`saveGatePass`) already extracts `MESSAGES` array errors and `TYPE: "E"` errors.
- It does not currently extract `STATUS: "FALSE"` failures.
- `src/routes/_authenticated/mm.gate-pass.tsx` renders the save response in `SapResponseDialog`. On error it builds a table with labels such as `Type E` or `Doc <number>`, which can display more than just the message text.

## Changes
1. In `src/lib/mm/gate-pass.functions.ts` (`saveGatePass`), add `STATUS: "FALSE"` extraction using the existing `extractFalseStatusMessagePreferMessage` helper, so the error path covers all three failure shapes.
2. In `src/routes/_authenticated/mm.gate-pass.tsx`, force `messageOnly: true` on the `SapResponseDialog` state when the save response is not OK, so only the exact message is shown without document numbers, type labels, tables, or raw response payloads.
3. Add regression tests in `src/lib/mm/sap-message.test.ts` for a `STATUS: "FALSE"` Gate Pass Save payload and verify the extracted message is exact.

## Verification
- `bun run build:dev` passes.
- New and existing regression tests pass.
- No other MM screen behavior is changed.
