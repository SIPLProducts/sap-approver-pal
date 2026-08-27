# Plan: Gate Pass save message, PO reject message, ZNFA attachment preview

## 1. Gate Pass — exact MESSAGE on Save when TYPE is "E"

Current state (verified): `saveGatePass` in `src/lib/mm/gate-pass.functions.ts` only reads `MESSAGES` and `TYPE`/`MESSAGE` at the top level of the SAP JSON; the screen already renders those in the SweetAlert response popup.

Change: make the save response parser shape-agnostic — unwrap double-encoded JSON strings and proxy/array envelopes (`data`, `DATA`, arrays), then recursively find the first `MESSAGES` array or `TYPE`/`MESSAGE` pair. When any `TYPE` is `E`/`A`, return `ok: false` with only the exact `MESSAGE` text (no extra keys appended). The screen's existing popup then shows exactly that message.

## 2. PO Release — exact MSGTXT on Reject when status is false

Current state (verified): `processPoAction` in `src/lib/mm/po-release.functions.ts` extracts `MSGTXT` and treats `FALSE` as failure, but when the middleware wrapper reports `ok !== true` it replaces the message with a generic "Middleware reported SAP status ..." string, and when `MSGTXT` is blank it substitutes "SAP returned reject status FALSE".

Change: always attempt `MSGTXT`/`MESSAGE` extraction from the SAP payload (including the middleware-wrapped `data`, lowercase `msgtxt`, nested arrays) before falling back to any generic text, and prefer that exact value as the reject failure message. The existing PO Reject popup keeps its current design and shows only the SAP text.

## 3. ZNFA Release — Object Description preview shows nothing

Current state (verified): `fetchZnfaAttachPrint` returns the base64 from `extractBase64Payload` in `src/lib/mm/znfa-attach.server.ts`; the screen decodes it into a Blob URL and renders it in the preview dialog (the same design as the NFA Preview). Base64 arrives at the middleware, so the loss is in extraction/assembly, not transport. The most likely cause — not yet confirmed — is `znfa-attach.server.ts`'s 200-character minimum for "looks like base64": SAP line tables split documents into short chunks (often ~132–255 chars per line), so short chunks are rejected and only a partial or no payload survives, producing a truncated file that the viewer refuses to open.

Steps:
1. Confirm the actual response shape by logging the print response structure (key paths, array lengths, chunk lengths) on the server for one call — no payload change.
2. Fix assembly based on that: allow short chunks when they belong to a uniform line-table array (drop the per-chunk length floor for array chunk joining, keep it for standalone strings), concatenate chunks in order across nested arrays, and only then apply the existing padding/normalisation.
3. Validate the assembled payload server-side: if the MIME type says PDF, require the `%PDF` header (the same check the NFA print function already uses); if it fails, return the SAP message instead of a broken preview so the user sees a clear error rather than a browser "can't open this file" dialog.
4. No change to the preview dialog UI, the payload, or any other logic.

## Files touched

- `src/lib/mm/gate-pass.functions.ts`
- `src/lib/mm/po-release.functions.ts`
- `src/lib/mm/znfa-attach.server.ts`

No UI redesign, no payload changes, no changes to unrelated screens.
