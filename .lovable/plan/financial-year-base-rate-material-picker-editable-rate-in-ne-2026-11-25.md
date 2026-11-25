# Financial Year Base Rate: Material picker + editable rate in New Record

## What changes
1. **Material column becomes a search picker** (both New Record and normal mode), same look and behaviour as the Customer / Customer Name pickers.
   - Calls SAP API `Finance_Material_F4_API` (from SAP API Settings) with payload `{ "material": "" }`.
   - Popup lists the returned `MATNR` values; picking one fills that row's Material only. Each row works independently.
   - The picked Material is what Save, Change and Delete already send (they read the row's MATERIAL).
2. **Financial Base Rate editable in New Record mode**: after Execute with New Record ticked, the rate is a typing box (same box already used in normal mode). The typed value is kept per row and sent in the existing Save payload as `FIN_RATE`.
3. **Normal mode**: Financial Base Rate stays exactly as today (already editable).

Nothing else changes: other columns, buttons, Save/Change/Delete requests and popups stay the same.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getFinanceMaterialF4Config` server function (case-insensitive lookup of `Finance_Material_F4_API`, same pattern as the other Finance config lookups).
- `src/routes/_authenticated/imw.financial-year-base-rate.tsx`:
  - add a `useQuery` for that config, like `custBasedNameCfgQuery`.
  - replace `text("MATERIAL", ...)` with a `CustomerSelect` cell: `inputs={{ material: "" }}`, `codeField="MATNR"`, `textField="MATNR"`, `onChange` → `updateRow(row, "MATERIAL", value)`.
  - remove the `executedCheck === "X"` read-only branch for FIN_RATE so the existing `Input` cell is used in both modes.
- No new files, no new imports beyond the new server function.
