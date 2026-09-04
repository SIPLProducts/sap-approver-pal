# Fix "IMW_PMU_EDIT_API not found" on Price Master Update

## Cause (verified)

The SAP API Settings entry is saved as **`IWM_PMU_EDIT_API`** (IWM, not IMW), while the Update action looks up **`IMW_PMU_EDIT_API`**. The names don't match, so the lookup fails and the popup shows "SAP API config ... not found".

## Change

In `src/lib/imw/price-master.functions.ts`, make the Update lookup accept either spelling: try `IMW_PMU_EDIT_API` first, then fall back to `IWM_PMU_EDIT_API` (case-insensitive name match on `sap_api_configs`). If neither exists, keep the current error message but list both accepted names.

Nothing else changes: payload structure (`update.data.update.data`), STATUS extraction, popup rendering, fetch flow, credentials dialog and table behaviour stay exactly as they are.

## Note

The screenshot is from the production site, so the same config must exist there as well; the fallback makes the screen work with either name in both environments.
