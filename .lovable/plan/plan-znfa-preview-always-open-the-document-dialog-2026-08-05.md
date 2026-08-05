# Plan: ZNFA Preview — always open the document dialog

## Current state (verified)

- The Preview button in the ZNFA document toolbar already calls `ZNFA_PRINT_API` through `fetchZnfaPrint`, sending exactly the payload you listed (`TYPE_NFA`, `ZRFQS: [{ RFQ: "" }]`, `GET`, `REL_CODE`, `ZNFA_NUM`, `PRINT: "X"`), and decodes the Base64 response into a `data:application/pdf` URL.
- The toolbar is shared by the Release path and the Display path, so Preview is already available in both.
- The `ZNFA_PRINT_API` config exists and is active (POST, fetch type).
- A preview dialog already exists with an inline PDF viewer.

Remaining gap: when SAP returns an error (or nothing printable), the code closes the dialog and shows only a toast. Also the inline `<embed>` of a `data:` URL can be blocked by some browsers, leaving a blank frame.

## What will change

1. Preview always opens the dialog
   - On click, open the dialog immediately with a loading state ("Generating preview…").
   - On SAP error, keep the dialog open and show the exact SAP `MSG` inside it instead of only a toast.
   - Remove the toast-only failure path.

2. More reliable PDF rendering
   - Convert the Base64 to a Blob URL in the browser and render it in an `<iframe>` (Blob URLs render reliably where `data:` URLs are blocked), revoking the URL when the dialog closes.
   - Add "Open in new tab" and "Download" actions in the dialog footer.

3. Small guards
   - Keep the existing behaviour of preserving the opened NFA number and release code in the payload; pass NFA type when known.
   - If no document is open, keep the current inline hint rather than firing the API.

## Technical notes

- `src/lib/mm/znfa-print.functions.ts`: unchanged payload/config lookup; return the raw base64 alongside the data URL so the UI can build a Blob.
- `src/routes/_authenticated/mm.znfa-release.tsx`: `onDocPreview` sets `printOpen` true before mutating; dialog renders loading / error / viewer states; blob URL created in a `useEffect` from the returned base64.
