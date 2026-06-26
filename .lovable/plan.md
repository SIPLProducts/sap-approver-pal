## Plan

Update both plant dropdown components to display `Plant Code - Plant Description` (using `VTEXT` from the SAP response), while keeping the selected value as just the plant code (so all downstream payloads / form state stay unchanged).

### Files to change

1. **`src/components/sap/plant-select.tsx`**
2. **`src/components/sap/plant-multi-select.tsx`**

### Changes

- Replace `extractPlants` with `extractPlantOptions` returning `{ code: string; text: string }[]`:
  - Reuse the existing row-detection logic.
  - For each row, read the code from the configured `plantField` / `VKORG` / `WERKS` / `PLANT` aliases (unchanged behavior).
  - Read description from `VTEXT` (also tolerate `Vtext` / `vtext` / `DESCRIPTION` / `TEXT` as fallbacks, prefer `VTEXT`).
  - Dedupe by code; sort by code.
- Use the option list (`plants: { code, text }[]`) instead of `string[]`:
  - Trigger button label: show `code — text` for the selected code (look up from options); for multi-select show comma-joined `code` only (badges keep code) to avoid overflow, but the dropdown items show `code — text`.
  - Single select trigger displays `code — text` when a value is selected and the option is found; falls back to the raw code if VTEXT is missing.
  - `CommandItem` rendering: show `<span className="font-mono">{code}</span> <span className="text-muted-foreground">— {text}</span>` (omit the dash/text when VTEXT is empty).
  - `CommandItem`'s `value` prop becomes `${code} ${text}` so the built-in search matches either the code or the description.
  - `onSelect` continues to call `onChange(code)` — selection contract unchanged.
- Multi-select "Select all" still operates on codes (`plants.map(p => p.code)`).
- Selected badges keep showing code only (compact); trigger summary shows codes joined.
- Fallback text input branches (when `Get_Plant` config is missing) are unchanged.

### Out of scope

- No changes to `getPlantConfig`, `runSapApi`, payload shape, or any consumers of `PlantSelect` / `PlantMultiSelect`.
- No changes to user-management plant inputs that are not driven by these components.
