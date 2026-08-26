# Gate Pass Execute popup + Material Reservation Document Number F4

## 1. Gate Pass — Execute error popup shows only the message

Today the Execute popup renders a two-column table ("Gate Pass" label + Message) plus a collapsible "Raw response" block, so the user sees more than the SAP text.

After the change, when Execute returns an error the popup shows only the exact `MESSAGE` value(s) returned by the middleware — one line per message, no label column, no type prefix, no raw JSON. Table rows stay empty on failure, as today. The Save response popup keeps its current look.

Technical: in `src/routes/_authenticated/mm.gate-pass.tsx`, add a `messageOnly?: boolean` field on the existing `responseDialog` state. Set it `true` in the Execute (`mutation.onSuccess`) branches. In the dialog body, when `messageOnly` is set, render just the message strings (`whitespace-pre-wrap`) instead of the table and the raw-response `<details>`. Server functions in `src/lib/mm/gate-pass.functions.ts` stay unchanged.

## 2. Material Reservation — Document Number F4 via ZMIRS_DOC_F4_API

The Document Number field becomes a searchable dropdown, populated automatically when the screen opens using the logged-in user's SAP ID.

- Payload: `{ "USER_ID": "<logged-in SAP user id>" }`
- Response: `[{ "DOCUMENT_NO": "3000000428" }, ...]` — each `DOCUMENT_NO` becomes an option
- The dropdown has a search box; the user can still clear the selection to leave it blank
- If SAP returns a failure (e.g. "Data is not available"), the exact message text is shown in a popup
- Selection screen, Execute/Save payloads, table and all other logic stay unchanged

### Technical details

1. New `src/lib/mm/zmirs-doc-f4.functions.ts` — `fetchZmirsDocF4` server function, modelled directly on `src/lib/mm/gate-pass-doc-f4.functions.ts`: config name `ZMIRS_DOC_F4_API`, `requireSupabaseAuth` middleware, same proxy/basic-auth resolution, same `sap_api_sync_log` writes, returns `{ numbers, error, sapMessage, fetched_at }` collecting `DOCUMENT_NO` values (deduped, order preserved).
2. New `src/components/mm/document-number-select.tsx` — searchable combobox (Popover + Command), same shape as `gate-pass-number-select.tsx`, props `value`, `onChange`, `userId`, `onFailure`, `disabled`; query keyed `["zmirs-doc-f4", userId]`, enabled once the SAP user id is known, `staleTime` 5 min. Includes a "Clear" item so the field can be emptied.
3. `src/routes/_authenticated/mm.material-reservation.tsx` — replace the Document Number `<Input>` with the new select, passing `userId` (already fetched via `getMySapUserId`). Add a small message `Dialog` (same pattern as Gate Pass) fed by `onFailure` to show the exact SAP failure text. No change to `execute()`, `doSave()`, columns, or `fetchMaterialReservation`.

Note: `ZMIRS_DOC_F4_API` must exist and be active in Admin → SAP API Settings; if it is missing the dropdown reports the config error rather than silently staying empty.
