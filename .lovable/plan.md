# Plan: NFA Preview honours the returned MIME type

## Current state (verified)

- `fetchZnfaPrint` already returns `mimeType` (defaults to `application/pdf`), but the ZNFA Release page never reads it.
- The blob URL is built with a hardcoded `new Blob([bytes], { type: "application/pdf" })`.
- The dialog always renders an `<iframe>`, and the download filename is always `<NFA>.pdf`.

## What will change (frontend only, `src/routes/_authenticated/mm.znfa-release.tsx`)

1. Track the MIME type
   - Store `res.mimeType` from the print response in state alongside the base64, resetting it when a new preview starts or an error occurs.

2. Build the blob with the real type
   - Use the stored MIME type (falling back to `application/pdf` when absent) as the Blob `type`, so the browser renders it correctly.

3. Render images as images
   - When the MIME type starts with `image/`, show an `<img>` centered in the preview area, scaled to fit the same height box (`max-h`/`max-w`, `object-contain`).
   - All other types keep the existing `<iframe>` PDF rendering.

4. Buttons keep working for both
   - "Open in new tab" and "Download" continue to use the same blob/data URL for images and PDFs.
   - Download filename extension derived from the MIME type: `image/png` → `.png`, `image/jpeg` → `.jpg`, `image/gif` → `.gif`, `image/webp` → `.webp`, `application/pdf` → `.pdf`, otherwise fall back to the subtype after `/` (sanitised), defaulting to `.pdf`.

Nothing else on the page, the server function, or the SAP payload changes.
