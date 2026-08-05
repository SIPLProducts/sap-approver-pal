# NFA Texts — three-level tree (Vendor → RFQ → Texts)

Extend the existing NFA Texts tree in the Award & Attachments card with an RFQ level between the vendor and the text rows.

## Behaviour

```text
▶ Arun Transport                  (parent = vendor, NAME1)
   ▶ 6000001234                   (child = RFQ number)
        Important, If Any   | <T&C text>
        Inspection          | <T&C text>
        Payment Terms       | <T&C text>
```

- Level 1: vendor name (`NAME1`), collapsed by default, chevron toggle.
- Level 2: RFQ number for that vendor, collapsed by default, chevron toggle, indented.
- Level 3: one row per `AVL_TEXTS` entry — NFA Texts column shows the `AVL_TEXTS` value, T&C column shows its corresponding text.
- Clicking a text row selects it (highlighted) and writes the joined `HEADER[].LINE` values into the Remarks textarea, exactly as today.
- Empty response keeps the "No NFA texts returned by SAP." message.
- Card layout, colours, table styling, budget/attachment sections and all other cards stay unchanged.

## Technical notes

- File: `src/routes/_authenticated/mm.znfa-release.tsx` (presentation only; no server-function changes).
- Replace `nfaTextGroups` with a nested grouping: vendor (`NAME1`, falling back to the existing `fallbackVendorName`) → RFQ key taken from the row's RFQ field (`EBELN`, with `RFQ`/`ANFNR` as alternates), falling back to `"—"` when SAP sends none.
- Add `expandedTextRfqs: Set<string>` state (keyed `vendor\u0000rfq`) alongside the existing `expandedTextVendors`; reset it in `applyZnfaDocument` and the existing reset path.
- Selection key becomes `vendor-rfq-AVL_TEXTS-index` so identical text labels under different RFQs stay independently selectable.
- T&C cell keeps its current source (first line of `textLines(t)`), so text content rendering is unchanged.
- Reuse the same chevron/indent pattern as `PrDetailsTreeCard` / `RfqDetailsTreeCard`.
