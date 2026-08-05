# NFA Texts: two-level tree (vendor → RFQ rows)

Flatten the current three-level NFA Texts tree (Vendor → RFQ → Texts) into the two-level layout shown in the reference screenshots.

## Behaviour

```text
▶ Arun Transport                        (parent = NAME1)
   ▼ expanded:
      6100079686   Important, If Any    (RFQ no. | AVL_TEXTS)
      6100079686   Inspection
      6100079686   Payment Terms  ...
```

- Parent row: vendor name (`NAME1`), collapsed by default, with expand/collapse arrow.
- Child rows: one row per NFA text entry for that vendor.
  - "NFA Texts" column shows the RFQ number (`EBELN` / `RFQ` / `ANFNR`).
  - "T&C" column shows the `AVL_TEXTS` label (e.g. "Payment Terms").
- Clicking a child row selects/highlights it and writes its `HEADER[].LINE` values (joined by newlines) into the Remarks text area, replacing previous content. Remarks stays editable.
- Empty response keeps the existing "No NFA texts returned by SAP." message.
- Card styling, other columns, and every other card/functionality stay unchanged.

## Technical notes

Single file: `src/routes/_authenticated/mm.znfa-release.tsx` (presentation only).

- Simplify `nfaTextGroups` to `{ vendor, items }` — drop the inner RFQ map; keep the `NAME1` fallback to the recommended vendor / NFA title.
- Remove the middle RFQ node: delete `expandedTextRfqs` state and `toggleTextRfq`, keep `expandedTextVendors` and `selectedTextKey`.
- Child cells: first cell = RFQ number (single indent, `pl-10`), second cell = `AVL_TEXTS`; row keeps `data-state="selected"` highlight and `onSelectNfaText`.
- `textLines(t)` (already joins `HEADER[].LINE`) continues to feed the Remarks value on selection.
