# Fix ZNFA attachment PDF preview

## Goal
Make the **Object Description** hyperlink display the PDF returned by `ZNFA_ATTACH_PRINT_API`, using the same reliable PDF preview behavior as the existing ZNFA **Preview** button.

## Confirmed current behavior
- The regular ZNFA Preview button and the Object Description hyperlink use separate server response parsers and separate preview state.
- The attachment path calls `ZNFA_ATTACH_PRINT_API` through the raw middleware route, then recursively searches and reassembles Base64 values.
- The attachment dialog renders inline only when the decoded result is identified as a complete PDF; the screenshot’s `ZIP · 13 KB` state means the bytes selected by the attachment parser begin with ZIP magic instead of the expected `%PDF` header.

## Implementation
1. **Correct attachment response extraction**
   - Unwrap middleware and SAP response envelopes consistently before selecting document data.
   - Prefer an explicit PDF/Base64 document field when present instead of allowing unrelated Base64-looking metadata to win.
   - For SAP line-table responses, preserve row order and evaluate the supported assembly forms, selecting only the candidate that decodes to a valid `%PDF` payload when SAP returned a PDF.
   - Return normalized Base64 and `application/pdf` to the existing client contract without changing the request payload or SAP API configuration.

2. **Reuse the proven preview behavior**
   - Keep the current Object Description click flow, dialog, Download, and Open in new tab actions.
   - Align its blob creation and inline iframe handling with the working ZNFA Preview button so valid PDF bytes are displayed directly rather than shown as a ZIP download card.

3. **Regression coverage and diagnostics**
   - Add focused tests for direct PDF Base64, middleware-wrapped responses, ordered line-table chunks, and independently padded chunks.
   - Keep diagnostics structural only: selected field/strategy, byte length, PDF header, and trailer status; never log document content.

## Scope preserved
No changes to the `ZNFA_ATTACH_API` or `ZNFA_ATTACH_PRINT_API` payloads, SAP settings, middleware contract, attachment tables, selection behavior, or other ZNFA actions.

## Verification
- Run the focused attachment parser tests and TypeScript checks.
- Verify that clicking an Object Description opens the existing Attachment Preview dialog with an inline PDF, while Download and Open in new tab continue to work.
