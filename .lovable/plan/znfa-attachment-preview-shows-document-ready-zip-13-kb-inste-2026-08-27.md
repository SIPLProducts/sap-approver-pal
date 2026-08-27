# ZNFA attachment preview shows "Document ready (ZIP · 13 KB)" instead of the PDF

The middleware receives a PDF Base64 payload, but the app now assembles bytes
whose magic bytes sniff as ZIP (`PK`) — meaning the Base64 lines coming back
from SAP are being stitched together in a way that misaligns the bytes, so the
decoded result is not the original file.

## Confirmed in code

`src/lib/mm/znfa-attach.server.ts` uses exactly one assembly strategy
(`joinBase64Chunks`): it strips the trailing `=` padding from every line and
concatenates the remaining characters. That is correct only when SAP splits one
continuous Base64 stream across lines. When each SAP line is an independently
padded Base64 unit (very common with `XSTRING`/line-table exports, where each
line encodes a whole number of bytes), removing the padding and concatenating
shifts every following line by 1–2 characters and produces garbage — which is
exactly the "wrong file type / wrong size" symptom on screen.

## Fix (in `src/lib/mm/znfa-attach.server.ts` only)

Replace the single assembly path with candidate generation plus scoring, keeping
every existing column/sequence-selection rule as-is:

For each candidate document column (already selected today) build these variants:

1. Current behaviour — strip per-line padding, join, re-pad once.
2. Join lines verbatim (padding kept) and decode.
3. Decode each line separately and concatenate the resulting byte buffers
   (handles independently padded lines).
4. If the lines are pure hex, decode as a hex `XSTRING` instead of Base64.

Score every produced byte buffer and keep the best one:

- decodes to `%PDF` and ends with `%%EOF` (best)
- decodes to `%PDF` without a trailer
- any other recognised magic (PNG/JPEG/ZIP/OLE)
- otherwise the longest buffer

Because the middleware confirms the file is a PDF, the PDF-scoring variant wins
and the preview receives valid bytes. The extractor keeps returning normalized
Base64 (re-encoded from the chosen buffer) so
`znfa-attach.functions.ts` and the preview UI need no change.

## Diagnostics (logs only, never content)

Extend the existing log line in `znfa-attach.functions.ts` /
`znfa-attach.server.ts` with which strategy won, the number of lines, the line
length distribution (min/max/mod-4), and the resulting byte length, so any
remaining mismatch is diagnosable from the server log without exposing payload
data.

## Out of scope

No change to the `ZNFA_ATTACH_API` / `ZNFA_ATTACH_PRINT_API` payloads, the
middleware, the attachment table, the Created By column, or the preview dialog
design. Non-PDF attachments keep today's download card.

## Verification

Typecheck plus the existing SAP message tests, then click an Object Description
link and confirm the PDF renders inline and the log reports a valid PDF header
and trailer with a plausible size.
