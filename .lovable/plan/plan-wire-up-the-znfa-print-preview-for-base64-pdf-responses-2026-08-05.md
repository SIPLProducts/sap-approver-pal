Plan: Wire up the ZNFA Print Preview for Base64 PDF responses

Goal

Enable the Preview toolbar button in the ZNFA Release screen so it calls the SAP ZNFA_PRINT_API, decodes the Base64 response, and shows the resulting PDF to the user.

Current state

- The ZNFA Release screen toolbar has a Preview button that only shows a toast: "Preview will be available once the SAP API is configured."
- No ZNFA_PRINT_API server function exists.
- SAP API configs can be stored in Admin → SAP API Settings; the Response tab is only for sync-to-local-table field mapping.
- The Node.js middleware (`/sap/invoke`) returns the raw SAP response when invoked from a server function.

What will be built

1. SAP API configuration guidance

   In Admin → SAP API Settings, create a config named `ZNFA_PRINT_API`:
   - Module: MM
   - HTTP method: POST
   - API type: `fetch` (not `sync`)
   - Endpoint: the SAP endpoint path/URL provided by your BASIS team
   - Active: true

   Leave the Response tab empty — do not import or map any response fields there. Response mapping is only for storing individual fields into local tables. For a Base64 PDF, the whole response is decoded and displayed.

2. Server function for ZNFA print

   Create `src/lib/mm/znfa-print.functions.ts` with a `fetchZnfaPrint` server function that:
   - Looks up the `ZNFA_PRINT_API` config by name.
   - Builds the SAP payload using the currently opened NFA document number plus the same user/release context already used by ZNFA Display/Click.
   - Calls the middleware at `/sap/invoke` with `raw: true` so the middleware does not strip the response envelope.
   - Handles the three possible response shapes:
     - A plain string that is Base64.
     - A JSON object where the Base64 string is under a key such as `DATA`, `data`, `PDF`, `pdf`, or `MSG` (error case).
   - Decodes the Base64 string to a `Buffer` and returns it as a `Uint8Array`/base64 data URL along with a MIME type (`application/pdf`).
   - If `STATUS === "FALSE"`, returns the raw `MSG` text as an error message exactly as the ZNFA Display functions already do.

3. UI integration

   Update `src/routes/_authenticated/mm.znfa-release.tsx`:
   - Replace the Preview button toast with an actual handler.
   - On click, call `fetchZnfaPrint` via `useServerFn` and the current NFA number.
   - On success, open a dialog containing an inline PDF viewer (`<iframe src={pdfDataUrl}>`) or offer a download.
   - On error, show the returned SAP `MSG` text using the existing error/alert pattern.
   - Show a loading state while the call is in flight.

4. Edge cases

   - Missing or inactive `ZNFA_PRINT_API` config → clear error message pointing to Admin → SAP API.
   - Middleware/network failure → show the same error format used by other ZNFA calls.
   - Non-array response with `STATUS: "FALSE"` → show only the raw `MSG` value.
   - Empty or malformed Base64 → show a user-friendly decode error.

Out of scope

- No changes to the SAP API Settings Response tab itself; the design intentionally leaves it unused for fetch APIs.
- No local storage of the PDF; it is rendered from memory.
- No print or download features beyond the browser's built-in PDF viewer controls.
