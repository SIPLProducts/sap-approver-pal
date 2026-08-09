# Fix ZNFA Preview showing a blank/blocked frame instead of the PDF

## Confirmed cause

The screenshot shows the preview frame navigating to
`data:application/pdf;base64,"JVBE…` — note the **double quote** right after
`base64,`. That means the base64 string the app received still carries the
JSON quoting characters from the SAP/middleware response.

Consequences in the current code:

- In `mm.znfa-release.tsx` the blob is built with `atob(printBase64)`. A `"`
  is not a valid base64 character, so `atob` throws, the `catch` sets
  `printBlobUrl = null`, and the dialog falls back to the raw `data:` URL.
- Browsers block navigation of top-level/iframe `data:application/pdf` URLs,
  so the frame renders the "It looks like the webpage at … might be having
  issues" error page seen in the screenshot.

So SAP and the middleware are fine — the payload is just not being cleaned
before decoding.

## Changes

### 1. `src/lib/mm/znfa-print.functions.ts` (sanitising)

In `normalizeBase64` (and before it, in `extractBase64Payload`):

- Strip a surrounding pair of single/double quotes from the extracted string.
- Strip an existing `data:<mime>;base64,` prefix if present, and use the mime
  from that prefix when the envelope did not provide one.
- Remove every character outside the base64 alphabet (whitespace, quotes,
  stray backslashes/`\n` escapes) before re-padding.
- Verify the cleaned string actually decodes (`Buffer.from(b64, "base64")`
  round-trip, and check the decoded bytes start with `%PDF` for PDFs). If it
  does not decode, return an error response with a clear
  "SAP returned a document that could not be decoded" message instead of a
  broken data URL.

Return the cleaned base64 and the resolved mime type as today.

### 2. `src/routes/_authenticated/mm.znfa-release.tsx` (robust rendering)

- Sanitise once more client-side before `atob` (same quote/prefix/alphabet
  cleanup) so any residue can never break blob creation.
- If blob creation still fails, show the existing error panel with a decode
  message instead of falling back to the `data:` URL in the `<iframe>`.
- "Open in new tab" and "Download" use the blob URL only (a blocked `data:`
  URL is never useful).

No changes to the SAP payload, the config lookup, or the middleware.

## Verification

Click Preview on the same NFA: the frame should display the PDF, the second
browser tab trick is no longer needed, and Download saves a valid `.pdf`.
