# ZNFA Rating — show exact MSG popup when response has TYPE: "E"

When the ZNFA Rating screen's Execute API (`ZNFA_Fetch_API`) returns a payload containing `TYPE: "E"`, the UI must show only the exact `MSG` value in a popup and must not render any rows in the results table.

## Files to change

1. `src/lib/mm/sap-message.ts`
2. `src/lib/mm/gate-process.functions.ts`
3. `src/routes/_authenticated/mm.gate-process.tsx`

## Server-side changes

In `src/lib/mm/sap-message.ts`, add a small helper that finds a `TYPE: "E"` envelope anywhere in the SAP payload and returns the exact `MSG` value:

```ts
export function extractTypeEErrorMessage(payload: any): string | null {
  const type = findFirstDeep(payload, ["TYPE"]);
  if (typeof type === "string" && type.trim().toUpperCase() === "E") {
    const msg = findFirstDeep(payload, ["MSG"]);
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return null;
}
```

In `src/lib/mm/gate-process.functions.ts`:

- Import `extractTypeEErrorMessage` from `src/lib/mm/sap-message.ts`.
- Inside `fetchGateProcess`, after parsing `sapJson` and before mapping rows, call `extractTypeEErrorMessage(sapJson)`.
- If a message is returned:
  - Write an error entry to `sap_api_sync_log` (keep the full response for debugging).
  - Return `{ rows: [], fetched_at, count: 0, user_id, error: <exact MSG value> }`.
- If no `TYPE: "E"` is found, keep the existing row-extraction logic exactly as it is.

## UI changes

In `src/routes/_authenticated/mm.gate-process.tsx`:

- Import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, and `DialogFooter` from `@/components/ui/dialog`.
- Add state: `const [messageDialog, setMessageDialog] = useState<{ open: boolean; message: string } | null>(null);`.
- In the `fetchGateProcess` mutation's `onSuccess`:
  - When `res.error` is present, clear `rows`, `selected`, `output`, `items`, `ratings`, and `lastAction`, then open `messageDialog` with the exact error string.
  - Keep the success toast and existing output state logic unchanged.
- Render the dialog near the bottom of the page, using the same compact design as the PO Release message dialog (`max-w-md`, title "ZNFA Rating", message body, Close button).

## Outcome

A response such as:

```json
{ "TYPE": "E", "MSG": "No ZNFA records found for the user" }
```

results in an empty results table and a popup showing exactly:

```text
No ZNFA records found for the user
```

No prefixes, no raw JSON, and no table rows are displayed.
