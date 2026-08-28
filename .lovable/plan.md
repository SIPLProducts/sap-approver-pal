# Gate Pass Return Receipt locking and ZNFA PDF preview repair

## Goal

- In Gate Pass, keep the results-table **Remarks** field disabled when the successful Execute mode is **Return Receipt**.
- In ZNFA Release, make the document returned by `ZNFA_ATTACH_PRINT_API` open as the actual inline PDF instead of being classified as a ZIP download.
- Preserve the existing SAP payloads, table behavior, and other approval workflows.

## Implementation

1. **Gate Pass field lock**
   - Add `REMARKS` to the Return Receipt mode’s locked field set in the existing results-table locking map.
   - Keep `RETURN_STATUS` and `RETURNED_QUANTITY` editable for Return Receipt, as they are today.

2. **Trace and normalize the attachment response without exposing document data**
   - Keep the middleware raw passthrough contract, but strengthen response parsing for the actual SAP envelope: nested/double-encoded JSON, Base64 strings, and SAP line-table chunks.
   - Select document candidates by decoded file signature and complete PDF structure rather than field order or encoded length.
   - If SAP wraps the PDF bytes in a ZIP container, extract the PDF member using a Worker-compatible pure JavaScript implementation before returning it to the browser; never label the wrapper itself as the final document.
   - Return only the normalized PDF Base64, PDF MIME type, and structural status to the client. Diagnostics will record shape, byte counts, and magic signatures only—not Base64 content.

3. **Preview handling**
   - Build the browser Blob from the normalized bytes and render confirmed PDFs in the existing preview iframe.
   - Keep Download and Open in new tab using the same normalized PDF Blob.
   - Show the existing error state only when no valid PDF can be recovered.

4. **Regression coverage and verification**
   - Extend attachment parsing tests for the real response shapes: nested middleware envelope, double-encoded payload, chunked PDF, misleading ZIP candidate beside a PDF, and ZIP-wrapped PDF.
   - Add/adjust a focused Gate Pass assertion for Return Receipt Remarks locking where practical.
   - Run the focused tests and verify the ZNFA preview visually in the authenticated app when a live attachment is available.

## Technical notes

- Expected files: `src/routes/_authenticated/mm.gate-pass.tsx`, `src/lib/mm/znfa-attach.server.ts`, `src/lib/mm/znfa-attach.functions.ts`, its focused tests, and only if required by the verified envelope, `middleware/json-repair.js` plus its tests.
- Keep every `createServerFn` module as a thin wrapper: runtime parsing helpers and constants remain in imported server/helper modules or inside handlers.
- No database, SAP API configuration, request payload, or unrelated UI changes.
