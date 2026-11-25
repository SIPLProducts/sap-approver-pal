# Average Selling Rate: dropdowns, editable rate, Change/Delete

## New Record ticked
- Customer, Customer Name and Material become the same pick-from-list dropdowns used on Financial Year Base Rate, using the same SAP lists:
  - Customer: customers of the row's plant
  - Customer Name: the name for the chosen customer
  - Material: all materials
- Picking a value fills that cell in the row.
- Row checkboxes, the Save button, and the hidden Updated Person / Updated Date / Approver / Status columns stay as they are now.

## New Record unticked
- Every row gets a checkbox at the start.
- Change and Delete buttons appear at the top right, with the same look as on Financial Year Base Rate. Both stay disabled until a row is selected.
- Customer, Customer Name and Material stay read-only, the same as on Financial Year Base Rate.

## Both modes
- Average Selling Rate can be typed into directly.

## Not connected yet
No Save, Change or Delete APIs have been provided for this screen. For now each button shows "SAP API not configured yet". I'll connect them once you send the API details.

## Technical details
- Only `src/routes/_authenticated/imw.average-selling-rate.tsx` changes. It reuses `getTransportPlantCustConfig`, `getTransportCustBasedNameConfig`, `getFinanceMaterialF4Config`, `CustomerSelect` and `Input` with the same props as Financial Year Base Rate. An `updateRow` helper sets the field by `__asrRowKey`.
- `showSelect` is always on. `headerExtras` is Save when the check is "X", otherwise Change (success variant) and Delete (destructive variant).
