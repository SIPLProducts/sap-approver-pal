# Price Master Update Approvals — PMUA_FETCH_API wiring

Wire the Price Master Update Approvals screen to the SAP API configured as `PMUA_FETCH_API`, render the response in the same table design as Price Master Update, and add Approve / Reject buttons above the table for Pending results.

## Behaviour

- Execute validates that at least one plant is selected, then calls the API with:

```text
{ "get_data": { "plant": [ { "plant": "3601" } ], "kunnr": [], "date_from": "", "date_to": "", "R_pen": "", "R_appr": "X", "r_rej": "" } }
```

- `plant` repeats one object per selected plant; `kunnr` holds `[{ "kunnr": "<customer>" }]` when a customer is chosen, otherwise empty.
- `date_from` / `date_to` carry the selected dates (blank when not set).
- Status radio maps to exactly one flag: Pending → `R_pen: "X"`, Approved → `R_appr: "X"`, Rejected → `r_rej: "X"`; the other two stay empty.
- Loading state while fetching; SAP errors and "no data" shown in the standard popup used on the other screens.
- Changing plant, customer, dates or the status radio clears the results table, so Execute must be pressed again.

## Results table

Same look and behaviour as the Price Master Update table (row checkboxes, select-all, selected count, sticky header, horizontal scroll), with columns in this order:

Plant, Customer ID, Customer Name, Waste Type, Material Number, Price, Default, Escrow Chg, Trip Chg, Deactive, Kgs, Lumsum, Inclusive, Manifest Qty, Manifest From Date, Manifest To Date, ZWB02 Price, Trip Price, Valid From, Valid To, CA Date, CA Number, Spc Handling Chg, Eqp Hire Chg, Un / Ln Chg, Others Chg, 1 Ton, 5 Ton, 8 Ton, 10 Ton, 12 Ton, 15 Ton, 18 Ton, 20 Ton, 25 Ton, 30 Ton, 35 Ton, Requester Id, Requester user Name, Requester date, Requester Time, Approver Date, Approver Time, Approver by, Price Remarks.

- Dates render DD-MM-YYYY, SAP zero dates (`0000-00-00`, `00000000`) blank.
- Amount columns right-aligned with the app's existing number formatting.
- All cells are read-only on this screen (no inline editing).

## Approve / Reject buttons

- Shown at the top-right of the results table only when the Pending option is selected and rows have loaded.
- Enabled once at least one row is checked; Approve styled green, Reject styled destructive, matching existing screens.
- Not wired to SAP yet — clicking shows a short note that the approve/reject service is pending. The API name, payload and response can be wired later without touching anything else.

## What stays the same

Selection card fields, radio group, Reset, permissions, sidebar entry, route path and every other screen or SAP function are unchanged.

## Technical notes

- New `src/lib/imw/price-master-approvals.functions.ts`: `fetchPriceMasterApprovals` server fn (`createServerFn({ method: "POST" })` + `requireSupabaseAuth`), copied in structure from `fetchPriceMaster` in `src/lib/imw/price-master.functions.ts` — same config/credential lookup (`sap_api_configs` name `PMUA_FETCH_API`), proxy vs direct resolution, `sap_api_sync_log` write, `pickRows`, single status-node error detection, and `{ rows, error, sapMessage, fetched_at }` return shape.
- Zod input: `plants: string[]` (min 1), `customer?`, `date_from?`, `date_to?`, `status: "pending" | "approved" | "rejected"`.
- `src/routes/_authenticated/imw.price-master-approvals.tsx`: replace the placeholder `execute()` with `useServerFn` + `useMutation`; add `rows`, `selected: Set<string>` state; render `CloudscapeApprovalTable` with `showSelect`, `selectedKeys`, `onSelectionChange`, an explicit `COLUMN_DEFS` list, and an action slot holding Approve / Reject for the pending status; errors via `SapResponseDialog` (`SapResponseDialogState`).
- Reuse `formatAmount` and `formatSapDateDMY` from `src/lib/format.ts`.
