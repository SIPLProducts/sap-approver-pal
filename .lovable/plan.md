## Root cause

`sap_response` returned by the server fn is the middleware envelope (`{ ok, status, data: { MESSAGE: [...] } }`), not SAP's body directly. The current swal looks for `sap_response.MESSAGE`, doesn't find it, and falls back to the generic "2 records accepted in SAP." line.

## Fix (frontend only, `src/routes/_authenticated/sd.price.tsx`)

Update `decisionMutation.onSuccess` MESSAGE extraction to also check the envelope's `.data`:

```ts
const sap: any = (res as any)?.sap_response ?? {};
const inner = sap?.data ?? sap;        // unwrap middleware envelope if present
const rawMsgs = inner?.MESSAGE ?? inner?.message ?? inner?.Messages ?? [];
```

Everything else (icon picking by TYPE, HTML table of Customer · Type · Message, title Approved/Rejected) stays as-is and will now render rows like:

- `(blank)` · `E` · `There are no access sequences for condition type ZBAS`
- `0001061569` · `S` · `Condition records saved`

Icon stays `error` whenever any row is `E`/`A`, so mixed responses correctly surface as an error popup.

No backend / middleware changes.
