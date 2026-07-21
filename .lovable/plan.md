## Confirmed findings

- The Release button correctly collects only checked rows and sends `PREQ_NO`, `PREQ_ITEM`, Release Group, Release Code, and Remarks.
- `PR_Release_API` is active, configured as `POST`, and its request fields correctly map to the required nested `RELEASE.*` payload.
- Recent integration logs show SAP calls returning HTTP 200, but the middleware records the mapped response as `{}`.
- The configured response paths are `[].MSGTXT` and `[].STATUS`, while the middleware’s response mapper does not support `[].` paths for a non-top-level array/object. It therefore strips the actual SAP response.
- The server function then treats the empty response as successful because no status field exists, producing a false-positive release result with no SAP message.

## Implementation plan

1. **Correct middleware response mapping**
   - Extend the existing mapper to handle configured `[].FIELD` response paths without discarding the SAP response.
   - Preserve the exact SAP message/status values and support common SAP envelopes or a direct object/array response.
   - Keep this backward-compatible with existing APIs and do not alter the configured HTTP method or request payload.

2. **Harden PR Release response validation**
   - Check the middleware’s top-level `ok`, `status`, and `error` fields before marking a row successful.
   - Parse `MSGTXT` and the configured `STATUS` field case-insensitively, while retaining compatibility with `MSGTY`, `TYPE`, and nested response envelopes.
   - Never infer success from an empty `{}` response; return a clear row-level error instead.

3. **Preserve current UI behavior**
   - Continue calling the API only from the Release button and only for checked rows.
   - Keep per-row SAP message toasts and refresh/remove rows only when SAP explicitly reports success.

4. **Validate the integration**
   - Add focused response-mapping tests for direct object, array, and nested-envelope SAP responses.
   - Verify the outbound payload remains exactly:
     `{"RELEASE":{"BANFN":"...","BNFPO":"...","REL_CODE":"...","REL_GRP":"...","REMARKS":"..."}}`
   - Confirm failed/empty middleware responses show an error and successful responses display `MSGTXT` and remove the released row.