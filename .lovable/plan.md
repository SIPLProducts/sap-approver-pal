# Material Reservation save message, ZNFA attachment print, Created By column

## 1. Material Reservation — exact MESSAGE when TYPE is "E"

On Save, the popup must show only the SAP text, e.g.
`Requested quantity should be lessthan or equal to total stock`.

The save handler already looks for a `MESSAGES` collection, but only resolves it
when the parsed body is an object it can walk. Harden it so the message is found
regardless of envelope shape:

- If the SAP body arrives as a JSON string (double-encoded), parse it once more
  before inspecting.
- Unwrap proxy envelopes (`data`, or an array wrapper) before scanning.
- Search recursively for any `MESSAGES` entry with `TYPE` `E`/`A` and return that
  entry's exact `MESSAGE` value, `ok: false`, nothing else appended.
- Keep the success path, payload building, list refresh and logging as they are.

No UI change — the popup already renders `res.message`.

## 2. ZNFA Release — Object Description hyperlink returns no output

The middleware logs show the Base64 arriving, so the transport works; the app
side fails to locate the Base64 inside the returned body. The current extractor
only checks a fixed key list (`PDF`, `DATA`, `FILE`, `CONTENT`, `BASE64`,
`ATTACHMENT`) on the first item, so any other SAP field name, a nested object,
or a chunked line-array response yields "no printable document".

Change `extractBase64Payload` in `src/lib/mm/znfa-attach.server.ts` to a
shape-agnostic search, keeping the existing preferred-key order first and only
then falling back:

- Recursively walk the response (objects and arrays).
- Collect string values that look like Base64 (length above a threshold, only
  Base64 characters) and ignore message/date/id-like short values.
- If several chunk strings are found under the same array (SAP line-table
  style, e.g. repeated `LINE` / `TDLINE` / `DATA` entries), concatenate them in
  order before normalising.
- Keep MIME detection from `FILE_EXT` / a `data:` prefix, and keep returning
  `msg` so a genuine SAP message still shows in the popup.

The preview dialog, Base64-to-blob decoding, open/download actions and all
payload mapping stay exactly as they are.

## 3. ZNFA Release — add Created By to the attachment details table

In `src/routes/_authenticated/mm.znfa-release.tsx`, add a third column
`Created By` to the Attachment Details table, rendering `CRONAM` (falling back
to `—` when empty), after `Created Date`. No other keys are shown; row
selection, hyperlink behaviour and the single-select rule stay unchanged.

## Technical summary

- `src/lib/mm/material-reservation.functions.ts` — robust recursive `MESSAGES`
  resolution (double-encoded / wrapped bodies included).
- `src/lib/mm/znfa-attach.server.ts` — shape-agnostic Base64 extraction with
  chunk concatenation.
- `src/routes/_authenticated/mm.znfa-release.tsx` — `CRONAM` column added.

Middleware code is unchanged, so no redeploy is needed for these fixes.
