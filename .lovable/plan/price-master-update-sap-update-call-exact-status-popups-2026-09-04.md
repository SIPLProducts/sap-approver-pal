# Price Master Update — SAP update call + exact STATUS popups

## What changes

1. **Update button now calls SAP.** In Price Master Update, after Execute loads rows and the user ticks rows, clicking the green Update button sends each selected row to the `IMW_PMU_EDIT_API` config from SAP API Settings, using the exact payload structure supplied (the nested `update.data.update.data` wrapper, one call per selected row, including any inline edits made to Price, ZWB02 Price and Price Remarks).
2. **Update result popup.** The response `[{ "TYPE": "S", "STATUS": "Updated Sucessfully" }]` is shown in the existing SweetAlert popup with the exact `STATUS` text — nothing else, no raw JSON. `TYPE: "E"` rows show the exact `STATUS` as an error.
3. **Execute error popup.** When the fetch response is `[{ "TYPE": "E", "STATUS": "No Authorization Your User Id ZIWM_MAINTAIN" }]`, the screen shows only that exact `STATUS` text in the popup and leaves the table empty instead of showing a generic message.

Everything else on the screen — filters, credentials dialog, columns, formatting, selection behaviour — stays as it is.

## Technical details

**`src/lib/imw/price-master.functions.ts`**
- Extend the existing `TYPE`/`STATUS` inspection in `fetchPriceMaster` so an array response whose first element has `TYPE = "E"`/`"A"` (or `STATUS` present with no data keys) returns `sapMessage = STATUS` verbatim and no rows. Keep current behaviour for normal row arrays.
- Add `updatePriceMaster` (`createServerFn({ method: "POST" })` + `requireSupabaseAuth`), config name `IMW_PMU_EDIT_API`, reusing the same config/credential/proxy resolution already in this file (`sap_api_configs`, `sap_api_credentials`, `sap_global_settings`, `sap_global_secrets`, `/sap/raw-invoke` with `x-shared-secret`, Basic auth fallback, `extra_headers`, `sap_api_sync_log` entries).
- Zod input: `rows: Array<Record<string, string | number | null>>` (min 1), plus optional `user_name` / `password` already collected by the credentials dialog.
- Body per row, sent verbatim: `{ update: { data: { update: { data: <row fields> } } } }` with the full field list (WERKS…PRICE_REMARKS), values passed through as received/edited; `PRICE` numeric, `PRUEFLOS` numeric, the rest strings.
- Return `{ results: [{ ref, message, ok }] }` where `message` is the SAP `STATUS` string and `ok = TYPE === "S"`, so the popup renders the exact text.

**`src/routes/_authenticated/imw.price-master.tsx`**
- Add a mutation via `useServerFn(updatePriceMaster)`; the Update button's `onClick` replaces the current placeholder toast and sends the selected rows merged with `edits`.
- Feed the returned results into the existing `SapResponseDialog` state (`refLabel: "Customer / Material"`), which already renders SAP messages without raw payloads.
- Keep the button green and disabled until at least one row is selected.
