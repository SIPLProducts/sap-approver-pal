# ZNFA Approved List — use ZNFA_APPROVE_GET_API

Today the **Approved List** action reuses the Release call (`ZNFA_RELEASE_GET_API` with `APP_LIST: "X"`). It will switch to the dedicated `ZNFA_APPROVE_GET_API` config, which is already configured and active (POST).

## Behaviour

1. Choose **Approved List**, pick a Release Code, click **Next** → calls `ZNFA_APPROVE_GET_API` with
   `{ USER: "<SAP user id>", REL_CODE: "<selected code>", CREATE: "", CHANGE: "", RELEASE: "", APP_LIST: "X" }`.
2. Results render in the same table, same columns and styling as the Release results (NFA No, Vendor Code, Purch. Group, Vendor Name, Plant, Plant Name, Vendor Rate, TER Rate, Total, Title, NFA Date, Release, Accept/Reject).
3. NFA No stays a hyperlink; clicking it calls `ZNFA_Click _API` exactly as it does today and renders the full detail layout (release matrix, header, PR/RFQ trees, final recommendation, attachments, NFA texts) unchanged.
4. Errors behave as now: `STATUS: "FALSE"` or HTTP/network/JSON failure shows the exact SAP `MSG` in the red alert plus a toast, no empty table. Empty array → "No records found".
5. The **Release** action keeps calling `ZNFA_RELEASE_GET_API` with `RELEASE: "X"` — no change.

## Technical notes

- `src/lib/mm/znfa-release.functions.ts`: pick the config name from `mode` — `app_list` → `ZNFA_APPROVE_GET_API`, `release` → `ZNFA_RELEASE_GET_API`. Everything else (proxy/direct handling, `raw: true`, `extractSapMsg`, sync-log inserts, `{ rows, error, sapMessage, fetched_at }` shape) stays identical; sync-log messages get a `znfa-approve` / `znfa-release` prefix per mode.
- `src/routes/_authenticated/mm.znfa-release.tsx`: no functional change needed — `onReleaseNext` already sends `mode: "app_list"` for Approved List and the table/hyperlink/detail rendering is shared.
- No schema, RLS, or admin API-settings changes.
