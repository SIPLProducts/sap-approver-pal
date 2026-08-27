# Fix ZNFA attachment document preview ("could not be decoded")

## What the popup is actually telling us

The message in the screenshot is produced by our own validation in
`src/lib/mm/znfa-attach.functions.ts`: after extracting the Base64 it decodes it
and rejects the document unless the first bytes are `%PDF`. Because
`ZNFA_ATTACH_PRINT_API` responses that carry no `FILE_EXT` fall back to
`application/pdf`, any non-PDF attachment (Word, image, message file) is treated
as a broken PDF and refused, even though the Base64 in the middleware log is
valid. A second, related weakness: when SAP splits the document across line-table
rows, each row's padding (`=`) can end up in the middle of the joined string, and
`Buffer.from(..., "base64")` stops at the first `=`, truncating the file.

## Fix (transport, payload and UI untouched)

1. `src/lib/mm/znfa-attach.server.ts`
   - When joining line-table chunks, strip trailing `=` padding from every chunk
     except the last, then re-pad once, so a chunked document decodes fully.
   - Add magic-byte sniffing on the decoded bytes to derive the real MIME type
     (`%PDF` → pdf, `PK` → docx/xlsx/zip, `\xD0\xCF\x11\xE0` → legacy Office,
     `\x89PNG`, `\xFF\xD8\xFF` → jpeg, `GIF8`), used only when SAP gives no
     `FILE_EXT` / no `data:` prefix.

2. `src/lib/mm/znfa-attach.functions.ts`
   - Replace the PDF-only gate: accept the document when the decoded bytes are
     non-trivial, using the sniffed MIME type when the fallback was a guess.
     Keep the "could not be decoded" message only for the genuine cases —
     Base64 that fails to decode or decodes to a few bytes.
   - Keep the existing structural-shape diagnostic log and add the first bytes as
     hex (magic only, no content) so any remaining case is diagnosable.

The preview dialog, blob handling, download/open actions, `ZNFA_ATTACH_PRINT_API`
payload, Attachment Details table and every other screen stay exactly as they
are; the PDF path behaves identically, non-PDF attachments now open or download
instead of being rejected.

## Verification

- Run the existing unit/type checks.
- Click an Object Description link and confirm the document renders (PDF inline,
  images inline, other types via Download).
