# ZNFA attachment preview shows a blank frame

## What the screenshot tells us

The preview dialog opens with the actions enabled, so the app did receive a
document and built a blob URL — the earlier "could not be decoded" error is
gone. A blank frame with a working blob means one of two things, and both are
currently indistinguishable in the UI:

1. The file is not something the browser renders inline (Word `.doc`/`.docx`,
   Outlook `.msg`, zip). An `<iframe>` for those renders empty.
2. The assembled Base64 is not a complete/valid PDF — for example SAP returned
   the document across many line-table rows and the rows were joined in the
   wrong order or one column was mixed in.

The diagnosis is not confirmed yet, so the first step of the work is to find out
which of the two it is, then fix only that path.

## Step 1 — Identify what actually arrived (no behaviour change)

The attachment print server function already logs magic bytes, byte length and
the response shape. Read those log entries for one failing click and use the
magic bytes to decide:

- magic `25 50 44 46` (`%PDF`) and a plausible size → case 2 (assembly bug).
- magic `50 4B` / `D0 CF 11 E0` / anything else → case 1 (not inline-viewable).

## Step 2a — If it is a non-PDF file (most likely)

Change only the preview dialog in `mm.znfa-release.tsx`:

- Instead of an empty `<iframe>`, show a small "document ready" card with the
  detected file type and size, plus the existing Download and Open in new tab
  buttons, whenever the resolved MIME type is not PDF or an image.
- PDFs and images keep rendering inline exactly as today.

No change to payloads, the attachment table, or any server function.

## Step 2b — If it is a PDF that renders blank

Fix the assembly in `src/lib/mm/znfa-attach.server.ts` only:

- When the document comes from a line table, order the rows by the SAP sequence
  field when one exists (e.g. `LINE_NO`/`SEQ`/index) rather than trusting
  object-key iteration, and join a single column's chunks only.
- Reject a candidate whose decoded bytes do not end with a valid PDF trailer
  (`%%EOF`) in favour of a longer candidate, so a partial chunk set is never
  preferred over the full document.

## Technical notes

- Touched files: `src/routes/_authenticated/mm.znfa-release.tsx` (2a) or
  `src/lib/mm/znfa-attach.server.ts` (2b). The other preview (ZNFA Print) and
  all SAP payloads stay untouched.
- Existing diagnostics stay structural only (magic bytes, lengths) — document
  content is never logged.

## Verification

- Typecheck plus the existing SAP message tests.
- Click an Object Description link and confirm the document either renders
  inline (PDF/image) or presents a clear download card with the right file name
  and extension.
