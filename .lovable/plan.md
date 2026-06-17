# Plant Dropdown from SAP `Get_Plant`

Replace every free-text **Plant** input across the SD approval screens with a single searchable dropdown component that fetches its options from the SAP API config named **`Get_Plant`** (defined in Admin → SAP API Settings).

## Scope (screens touched)
- `src/components/sd/sd-approval-shell.tsx` (used by Contract / Price / Sales Order screens)
- `src/routes/_authenticated/sd.sc-so.tsx` (SC-SO Approval screen — has its own Plant input)

No other UI, business logic, table columns, or SAP request fields change. The value submitted to existing SAP calls stays the same string (e.g. `"3801"`) — only the input control changes.

## New component
`src/components/sap/plant-select.tsx` — a Combobox built on existing shadcn `Popover` + `Command` (already in the project). Props: `value`, `onChange`, `placeholder?`, `disabled?`, `className?`.

Behavior:
- On mount, calls `runSapApi({ configId, inputs: {} })` once via TanStack Query (`queryKey: ["sap-plants"]`, `staleTime: 5 min`).
- Renders typeahead search over the returned list. Each option shows the plant code; selecting one calls `onChange(code)`.
- States: loading spinner, error message with retry, "no plants" empty state.
- Falls back gracefully: if the `Get_Plant` config is missing or the call fails, the dropdown becomes a plain text input so screens stay usable.

## Resolving the `Get_Plant` config id
Add a tiny server fn `getPlantConfigId` in `src/lib/sap/sap.functions.ts`:
- Looks up `sap_api_configs` by `name = 'Get_Plant'` (admin RLS via `requireSupabaseAuth` + admin client read of just the id is fine since the config id is not sensitive).
- Returns `{ configId, plantField }` where `plantField` defaults to `"VKORG"` (matches your sample payload) and can later be made configurable.

The `PlantSelect` component calls this once, caches the id, then calls `runSapApi`. Response parsing: accepts either a top-level array `[{ VKORG: "0001" }, …]` or `{ DATA: [...] }` (mirroring the SC-SO middleware shape), then extracts the `plantField` from each row, dedupes, and sorts.

## Wire-up in screens
- **`sd-approval-shell.tsx`** — replace the `<Input value={plant} … />` at line 97 with `<PlantSelect value={plant} onChange={setPlant} />`. Filtering logic (line 67) unchanged.
- **`sd.sc-so.tsx`** — replace the Plant `<Input>` at line 247 with `<PlantSelect value={plant} onChange={setPlant} />`. All downstream usage (`plant.trim()`, request payload `PLANT: p`) unchanged.

## Notes / assumptions
- Your sample response uses the key **`VKORG`** (which is technically SAP Sales Org, not Plant — `WERKS` is Plant). I'm taking the response at face value and using `VKORG` as the plant code shown + submitted. If `Get_Plant` should actually return `WERKS`, the `plantField` default is a one-line change.
- The `Get_Plant` config must already exist in Admin → SAP API Settings and be `is_active = true`. If not, the dropdown falls back to a text input and shows a small "Configure Get_Plant in SAP API Settings" hint.
- No changes to middleware, SAP credentials, or any approval logic.
