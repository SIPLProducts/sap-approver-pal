# Show the exact SAP message in ZMC/ZGP Cancel popups

## Cause

When Cancel is clicked, SAP does return the real message:

```json
[{"TYPE":"E","MESSAGE":"You are not authorised to cancel the Document"}]
```

But the response travels through the middleware proxy, which wraps the SAP payload in an envelope (e.g. `{ "data": [ ... ] }`). The message extractor in `src/lib/mm/zmc-report.functions.ts` and `src/lib/mm/zgp-report.functions.ts` (`extractSapMsg`) only checks one level deep (`node.MESSAGE`, `node.data.MESSAGE`), so it misses `MESSAGE` when it sits inside `data` as an array element. Extraction returns `null`, and the code falls back to the generic text **"SAP returned an error"** — which is what the popup showed.

## Fix

In both `src/lib/mm/zmc-report.functions.ts` and `src/lib/mm/zgp-report.functions.ts`:

1. Parse the raw response text, unwrap the proxy envelope (`json?.data ?? json`), and extract the message with the existing recursive `extractSapMessage` helper from `src/lib/mm/sap-message.ts`, which finds `MESSAGE` / `MSGTXT` at any depth (objects and arrays).
2. Keep the existing `extractSapMsg` regex fallback for non-JSON responses.
3. Apply this in every cancel-path failure branch: HTTP error, invalid JSON, and the TYPE `E` / STATUS `FALSE` result row, so the popup always shows SAP's exact text — only falling back to a generic line when SAP truly sent no message.

## Outcome

The popup shows exactly what SAP returned:

```text
ZMC Cancel
Document Number    Message
3000000352         You are not authorised to cancel the Document
```

No changes to payloads, filters, selection, refresh, or any other screen behavior.
