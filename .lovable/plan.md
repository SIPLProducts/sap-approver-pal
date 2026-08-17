# Gate Pass — show exact middleware messages in the popup

## Problem

Today the Gate Pass screen changes the SAP text before showing it:

- On Execute, only the first error message is returned; other messages are dropped.
- On Save, multiple messages are joined into one line with `"; "`, and the document number is appended as `(Doc: ...)`.

So when the middleware returns two errors like `Document Already Approved` and `YOU ARE NOT AUTHORIZED FOR HOD APPROVAL`, the user does not see both exactly as sent.

## What changes

The popup will list every message returned by the middleware, one row per message, with the text passed through untouched — no joining, prefixing, rewording, or fallback substitution when the middleware provided text.

- Execute: if the response carries multiple `TYPE: "E"` (or `"A"`) entries, all of them appear in the popup, in the order received. Table rows stay empty on failure, as today.
- Save: each returned message appears as its own row with its own type, instead of one concatenated string.
- Behaviour with a single message stays exactly as it is now.
- Selection screen, table, save payload, logging and all other logic remain unchanged.

## Technical details

1. `src/lib/mm/sap-message.ts` — add a collector helper (e.g. `collectSapMessages`) that walks the payload, finds any `MESSAGES` array at any depth (plus a single `TYPE`/`MESSAGE`/`MSGTXT` envelope), and returns `Array<{ type: string; message: string }>` with raw, untrimmed-of-content text. Existing exported helpers stay as-is so other screens are unaffected.
2. `src/lib/mm/gate-pass.functions.ts`
   - `fetchGatePass`: on failure, in addition to the existing `error` string (kept for compatibility), return `messages: Array<{ type, message }>` built from the collector. Keep the existing empty-header/empty-rows returns and `sap_api_sync_log` inserts unchanged.
   - `saveGatePass`: return the same `messages` array alongside the current `ok` / `message` / `document_number` / `error` fields; stop relying on the joined string for display (the field itself stays for compatibility).
3. `src/routes/_authenticated/mm.gate-pass.tsx`
   - When `messages` is present and non-empty, map it into `responseDialog.results` — one entry per message, `message` used verbatim, `ok` derived from the type (`E`/`A` = not ok).
   - Fall back to the current single-entry behaviour when `messages` is empty.
   - The document number, when present, shows as the row label only; it is not appended into the message text.
4. Extend `src/lib/mm/sap-message.test.ts` with a case asserting two `TYPE: "E"` entries come back as two separate, unmodified strings.
