# MM Popups Cleanup + ZNFA Attachment Display & Print

## 1. Swal popups (all MM Approvals screens)
- Remove the collapsible "Raw response" block from the SAP response popup so only the message table (or single message) is shown.
- Increase the readability of popup content: larger font for the message text, table cells and headers.
- No change to which messages are shown, to any API call, or to any screen logic.

## 2. ZNFA Release — Attachments List
Applies to results from Release, Display and Approve List flows.

- Attachments List checkbox becomes single-select: selecting a row clears any other selection.
- "Display" button (next to Attachments List) now calls the `ZNFA_ATTACH_API` config from SAP API Settings, sending the selected row as the documented array payload:
  `[{ CHECK: "X", VENDOR, NAME1, ATTACHMENT_ID, NO_ATTACHMENTS }]`
  taken from the selected attachment row.
- If no row is selected, show the existing-style message popup asking to select one attachment.
- On response, a new results table appears below the Attachments List and the page auto-scrolls to it.
- That table shows only two columns:
  - Object Description (`OBJDES`)
  - Created Date (`CRDAT`)
  No other response keys are displayed.
- SAP errors (TYPE "E" / STATUS "FALSE" / MSG) surface through the existing SweetAlert response popup; the table stays empty.

## 3. Attachment document preview
- `OBJDES` renders as a hyperlink. Clicking it calls the `ZNFA_ATTACH_PRINT_API` config, sending the full response row for that attachment back as the array payload (all keys exactly as received, including `IF_DOC_BCS` / `IF_DOC_CLS`).
- The Base64 response is decoded and shown in the same preview dialog design already used by the ZNFA Preview button (blob URL in an iframe for PDFs, inline image for image types, Open in new tab + Download actions, loading and error states).
- File type is taken from the response MIME type / `FILE_EXT` fallback so non-PDF attachments (e.g. .doc) download rather than fail silently.

## Technical notes
- `src/lib/mm/swal.ts`: drop the `swal-brand-raw` details markup from `buildHtml`; bump font sizes in the SweetAlert brand CSS in `src/styles.css`. `SapResponseRow.response` stays in the type so no caller changes are needed.
- New server functions in `src/lib/mm/znfa-attach.functions.ts`, modelled on `znfa-print.functions.ts`: `fetchZnfaAttachments` (config `ZNFA_ATTACH_API`, returns rows + sap message) and `fetchZnfaAttachPrint` (config `ZNFA_ATTACH_PRINT_API`, returns normalized base64 + mime, reusing the same base64 cleaning/validation approach). Both use `requireSupabaseAuth`, the admin client inside the handler, proxy/basic auth resolution and `sap_api_sync_log` entries exactly like the print function.
- `mm.znfa-release.tsx`: new state for attachment rows, mutations, a `ref` for scroll-into-view, single-select checkbox handling, and a second preview dialog reusing the existing blob-URL effect pattern. Existing print/preview state and all other handlers untouched.
- Both API configs must exist and be active in SAP API Settings; if a config is missing the popup reports it, matching current behaviour for other ZNFA APIs.
