# ZNFA attachment preview: PDF arrives but renders blank

Confirmed by you: the middleware response carries a real PDF (not a zip/Word
file). That rules out the "browser can't render this type" branch and points at
how the Base64 is reassembled on our side before it reaches the preview.

## Where the assembly can lose bytes

`src/lib/mm/znfa-attach.server.ts` rebuilds the document from the SAP line
table. Three things in that code can silently produce a truncated PDF, which is
exactly what a blank frame with working Download/Open buttons looks like:

1. Every candidate line must be at least 8 characters to be treated as a chunk.
   The final line of a SAP document is often shorter, so the tail of the file
   (including the `%%EOF` trailer) can be dropped.
2. Chunks are grouped by object key using plain iteration order. If the line
   table rows carry a sequence/line-number column, the document must be ordered
   by that column rather than by arrival order.
3. Other string columns in the same rows (short codes, numeric line numbers)
   pass the "looks like Base64" charset test and can be concatenated into the
   document, corrupting it.

## Fix

`src/lib/mm/znfa-attach.server.ts` only:

- Sort line-table rows by an explicit sequence field when present
  (`LINE_NO`, `LINE`, `SEQ`, `SEQNR`, `ZEILE`, `NO`), otherwise keep arrival
  order, and assemble from a single column.
- Accept short final chunks: when a key already has multiple long chunks, keep
  its remaining shorter lines instead of discarding them, so the file tail and
  `%%EOF` survive.
- Ignore columns that are clearly not document data (purely numeric values, or
  columns whose total length is far below the largest column) when choosing
  which column holds the file.
- Prefer a candidate that decodes to `%PDF` … `%%EOF` (already implemented);
  additionally log whether the chosen candidate has a valid header and trailer,
  its byte length and page-object count, so a remaining failure is diagnosable
  from the logs without ever logging content.

`src/lib/mm/znfa-attach.functions.ts`: keep behaviour, extend the existing
structural log line with `pdfHeader=yes/no trailer=yes/no` for the same reason.

## Preview behaviour

`src/routes/_authenticated/mm.znfa-release.tsx` keeps today's design. Only one
change: when the resolved type is PDF but the bytes lack a valid trailer, show
the existing "document ready" card with a short note that the file may be
incomplete, instead of an empty frame — Download and Open in new tab stay as
they are. Complete PDFs render inline exactly as now.

## Out of scope

No change to the `ZNFA_ATTACH_API` / `ZNFA_ATTACH_PRINT_API` payloads, the
attachment table, the middleware, or any other screen.

## Verification

- Typecheck plus existing SAP message tests.
- Click an Object Description link, confirm the PDF renders inline, and check
  the server log line shows a valid header and trailer with a plausible size.
