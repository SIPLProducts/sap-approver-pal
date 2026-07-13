## Plan

1. **Fix malformed SAP JSON parsing in the middleware**
   - Update the middleware JSON parser so SAP responses with raw control characters inside string values are sanitized before parsing.
   - Keep the existing repairs for missing values and dangling commas, but add a string-aware repair step for invalid JSON control characters such as raw newlines, carriage returns, tabs, and other ASCII control bytes.

2. **Return the real Search Term rows instead of a parse-error object**
   - Ensure `/sap/invoke` returns the parsed SAP data array/object when repair succeeds.
   - Preserve useful trace info like `json_repaired=true`, response byte count, and row count.
   - Avoid changing the request payload for `Get_Search_Term`; it should remain a GET call with `{}` inputs, matching the middleware log.

3. **Harden app-side Search Term response handling**
   - Keep the app extractor compatible with the expected response shape:
     ```text
     [{ "SEARCH_TERM": "PWMP-1180" }, ...]
     ```
   - Add a clear fallback/error path if the middleware still returns `__parse_error`, so the dropdown does not silently show no options.

4. **Validate with focused tests**
   - Add/update middleware parser tests using a sample SAP JSON string that includes an unescaped control character inside a value.
   - Keep the existing Search Term extractor test for `SEARCH_TERM` rows.
   - Verify the dropdown can receive and display `PWMP-1180`, `LUCKY ENGINEERS`, and `ARORA REFRACTORIES` once the parser returns the data array.

## Technical notes

- Root cause: the middleware currently repairs malformed JSON outside strings, but the actual SAP response fails because of a bad control character inside a JSON string. That makes `safeParseSapJson()` return `{ __parse_error: ... }`, so the app never receives searchable rows.
- The fix belongs primarily in `middleware/server.js`; the app component parser is already close, but should surface parser errors more clearly.