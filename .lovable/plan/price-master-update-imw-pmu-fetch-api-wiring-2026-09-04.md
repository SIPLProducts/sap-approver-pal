# Price Master Update — IMW_PMU_FETCH_API wiring

Wire the Price Master Update screen to the SAP API configured as `IMW_PMU_FETCH_API` in SAP API Settings, render the response in a labelled table, and add per-row checkboxes like PR Release.

## Behaviour

- **Display + Execute** → call the API with `R_DIS = "X"`, `R_UPD = ""`, and `user_name` / `PASSWORD` sent as empty strings.
- **Update + Execute** → the existing credential popup opens on selecting Update; its Execute sends `R_DIS = ""`, `R_UPD = "X"`, `user_name` = entered User ID, `PASSWORD` = entered password.
- Payload sent exactly as:

```text
{ "get_data": { "plant": [ { "plant": "3601" } ], "kunnr": [], "R_DIS": "X", "R_UPD": "", "user_name": "...", "PASSWORD": "..." } }
```

  `plant` repeats one object per selected plant; `kunnr` holds `[{ "kunnr": "<customer>" }]` when a customer is chosen, otherwise stays empty.
- Loading state while fetching; SAP error messages shown in the standard popup style used elsewhere.
- Response array rows populate the results table. Empty response shows the existing empty state.

## Results table

- Fixed column order and business labels: Plant, Customer ID, Customer Name, Waste Type, Material Number, Price, Default, Escrow Chg, Trip Chg, Deactive, Kgs, Lumsum, Inclusive, Manifest Qty, Manifest From Date, Manifest To Date, ZWB02 Price, Trip Price, Valid From, Valid To, CA Date, CA Number, Spc Handling Chg, Eqp Hire Chg, Un / Ln Chg, Others Chg, 1 Ton, 5 Ton, 8 Ton, 10 Ton, 12 Ton, 15 Ton, 18 Ton, 20 Ton, 25 Ton, 30 Ton, 35 Ton, Price Remarks.
- Date fields render as DD-MM-YYYY, with SAP zero dates (`00000000`, `0000-00-00`) shown blank.
- Amount columns right-aligned with the app's existing number formatting.
- A checkbox column on every row plus a select-all header checkbox, matching PR Release selection behaviour, with the selected count shown above the table.

## What stays the same

- Existing selection card, radio behaviour, credential popup markup, Reset, permissions, sidebar and route are unchanged.
- No other screen, SAP function, or shared component is modified.

## Technical notes

- New `src/lib/imw/price-master.functions.ts`: `fetchPriceMaster` server fn (`createServerFn` + `requireSupabaseAuth`), modelled on `src/lib/sd/contract-approval.functions.ts` — reads the `IMW_PMU_FETCH_API` row from `sap_api_configs`, resolves credentials / connection mode the same way, posts the `get_data` body, and returns the raw row array.
- Zod input: `plants: string[]` (min 1), `customer?: string`, `mode: "display" | "update"`, `user_name`, `password`.
- `src/routes/_authenticated/imw.price-master.tsx`: replace the placeholder `execute()` with a TanStack `useMutation` calling the server fn via `useServerFn`; add `selected: Set<string>` state; render `CloudscapeApprovalTable` with `showSelect`, `selectedKeys`, `onSelectionChange`, and an explicit column list (labels above) instead of `buildDynamicColumns`.
- Reuse `formatSapDateDMY` and `formatAmount` from `src/lib/format.ts`; SAP errors surfaced through the existing `SapResponseDialog` pattern.
