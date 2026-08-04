# PR Details as an expandable tree table

Turn the PR Details card into a grouped tree table: one parent row per Purchase Requisition number, with its item rows revealed on expand.

## Behaviour

```text
+----------------------------------------------------------------+
| PR DETAILS                                                     |
|----------------------------------------------------------------|
| >  10000123   (3 items)                                        |
| v  10000124   (2 items)                                        |
|      PR Item | Material | Item Text | Qty | UoM | PR Date | ... |
|      10      | 4001234  | Cable ... | 5.0 | EA  | ...     |     |
|      20      | 4001235  | Panel ... | 2.0 | EA  | ...     |     |
+----------------------------------------------------------------+
```

- Rows returned by SAP (`PR_DET`) are grouped by `BANFN` (PR number), preserving SAP order.
- Parent row: chevron toggle + PR number + item count. Clicking the row or the chevron expands/collapses.
- Child rows show the item columns already defined for PR Details minus the PR number: PR Item, Material/Services, Item Text, Qty, UoM, Plant, Plant Name, PR Date, plus PR Creation Date and Created By when SAP sends them.
- All groups start collapsed. Empty state text and card chrome stay as they are.
- Only the PR Details card changes; RFQ Details, Final Recommendation and Approval Matrix keep the flat table.

## Technical notes

- Single file: `src/routes/_authenticated/mm.znfa-release.tsx`.
- Add a `PrDetailsTreeCard` component next to the existing `DetailsTableCard`, reusing the same `Card`, `Table`, `DetailColumn` and `cellText` helpers plus a local `Set<string>` of expanded PR numbers.
- Child columns come from `PR_DETAIL_COLUMNS` with `BANFN` filtered out; add `BADAT` (PR creation date) and `ERNAM` (created by) entries, which render "—" if absent.
- Chevron uses the lucide `ChevronRight`/`ChevronDown` icons already available; no new dependencies, no styling tokens added.
- No API, mapping, or state changes — `prRows` stays the data source.
