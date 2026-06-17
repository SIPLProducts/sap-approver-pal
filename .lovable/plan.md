## Replace Plant text input with PlantSelect dropdown on remaining SD screens

The SC-SO screen already uses `<PlantSelect>` (searchable dropdown sourced from the `Get_Plant` SAP API config). The Contract, Price, and Sales Order approval screens still render a plain `<Input>` for Plant. Make them consistent.

### Changes

1. **`src/routes/_authenticated/sd.contract.tsx`**
   - Add `import { PlantSelect } from "@/components/sap/plant-select";`
   - Replace the Plant `<Input>` (~line 285) with `<PlantSelect value={plant} onChange={setPlant} />`.

2. **`src/routes/_authenticated/sd.price.tsx`**
   - Same import.
   - Replace the Plant `<Input>` (~line 237) with `<PlantSelect value={plant} onChange={setPlant} />`.

3. **`src/routes/_authenticated/sd.sales-order.tsx`**
   - Same import.
   - Replace the Plant `<Input>` (~line 310) with `<PlantSelect value={plant} onChange={setPlant} />`.

No backend, server-function, or business-logic changes. The existing `Enter`-to-execute behavior on the Plant input goes away on these screens (matching SC-SO, where Execute is a button click). All other selection-screen inputs (User ID, Customer From/To) remain unchanged.

### Verification

After edits, open Contract / Price / Sales Order screens and confirm the Plant field renders the same searchable dropdown populated from `Get_Plant`, and Execute still fetches against the selected plant.