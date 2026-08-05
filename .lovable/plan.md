# NFA Texts as a vendor tree view

Turn the NFA Texts table in the Award & Attachments card into a two-level tree, matching the reference screenshots.

## Behaviour

```text
▶ Arun Transport                 (parent = vendor name)
   ▼ expanded:
      • Important, If Any        (each AVL_TEXTS entry)
      • Inspection
      • Payment Terms  ...
```

- Parent row: vendor name (`NAME1`) with an expand/collapse arrow, collapsed by default.
- Child rows: every `AVL_TEXTS` value returned for that vendor.
- Clicking a child selects it (highlighted) and writes its text content — the joined `HEADER[].LINE` values — into the Remarks text area beside the tree.
- Selecting a different text replaces the Remarks content; the field stays editable as today.
- Empty response keeps the current "No NFA texts returned by SAP." message.
- Existing styling (card, table, muted colours), the T&C column data, and all other cards/functionality stay unchanged.

## Technical notes

- File: `src/routes/_authenticated/mm.znfa-release.tsx` (presentation only; no server function changes).
- Group `nfaTextRows` by `NAME1` on the row; when SAP does not send `NAME1`, fall back to the recommended vendor name from `recommendRows` (`APP_VENDOR = "X"` row's `NAME1`), then to the NFA title, so there is always a single parent node.
- New local state: `expandedTextVendors: Set<string>` and `selectedTextKey: string | null`; reset both in `applyZnfaDocument` and the existing reset path.
- Remarks text = `HEADER` array mapped over `LINE` and joined with newlines (falls back to the single-line value already rendered).
- Reuse the same chevron/indent pattern already used by `PrDetailsTreeCard` and `RfqDetailsTreeCard` for visual consistency.
