# Fix ZNFA Preview failing before the SAP call

## Confirmed cause

The error text in the dialog is a Zod validation error, not a SAP error:

```text
too_big, maximum: 20, path: ["nfaType"]
```

In `src/lib/mm/znfa-print.functions.ts` the input validator declares
`nfaType: z.string().trim().max(20)`. The UI sends `nfaType` from the SAP
display response (`TYPE_NFA`, set at line 700 of
`src/routes/_authenticated/mm.znfa-release.tsx`), and for this NFA that value
is longer than 20 characters.

Because validation throws, `.handler()` never runs — so no request is sent to
the middleware. That matches "even in middleware the payload is not going".

## Change

`src/lib/mm/znfa-print.functions.ts` only:

- Widen `nfaType` to `.max(120)` so real SAP `TYPE_NFA` values pass.
- Defensively truncate the value to the SAP field length when building
  `TYPE_NFA` in the payload, so an unusually long value can never block the
  call again.
- Same defensive treatment for `relCode` (currently `.max(10)`): accept a
  longer string and trim it in the payload rather than rejecting the request.

No UI, payload-shape, middleware, or SAP config changes. The payload stays:

```json
{ "TYPE_NFA": "", "ZRFQS": [{ "RFQ": "" }], "GET": "", "REL_CODE": "", "ZNFA_NUM": "…", "PRINT": "X" }
```

## Verification

Click Preview on the same NFA: the dialog should now show either the decoded
PDF or an actual SAP `MSG`, and the middleware log should show the outbound
`ZNFA_PRINT_API` call.
