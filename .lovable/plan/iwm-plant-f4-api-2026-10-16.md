# IWM Plant F4 API

## Goal
Use the configured `IWM_PLANTS_F4` API for Plant fields across every IWM screen, preserving the existing multi-select experience and unrelated behavior.

## Changes
- Add an authenticated lookup for the active `IWM_PLANTS_F4` SAP API configuration.
- Extend the existing multi-select Plant picker with a separate IWM source. For this source, call the configured API with `{ werks: "" }` and map each response row's `WERKS` and `NAME1` fields to an option labeled `WERKS_NAME1`.
- Point the Plant picker on Price Master Update, Price Master Update Approvals, and Transportation (90%) Exception Billing to the IWM source. Keep the current selection state, active-plant filtering, request payloads for each screen, and other fields unchanged.
- Leave all non-IWM screens and the existing `default` / `user-plant` picker sources unchanged. If the IWM API configuration is unavailable, preserve the picker’s existing text-input fallback.

## Technical details
- Update `src/lib/sap/plant.functions.ts`, `src/components/sap/plant-multi-select.tsx`, and the three `src/routes/_authenticated/imw.*.tsx` screens.
- Reuse the current response extraction and searchable checkbox multi-select UI, adding only IWM-specific source lookup, input payload, and label formatting.
- Do not change SAP API settings or database contents; the app will look up the configured API by name.
