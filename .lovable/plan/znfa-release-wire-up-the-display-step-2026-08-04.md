# ZNFA Release — wire up the Display step

Confirmed: the SAP API config `ZNFA_DISPLAY_GET_API` exists and is active (POST). Today the Display step only reveals an empty form — no SAP call, and the PR Details table columns don't match the SAP fields.

## Behaviour

When the user enters a Main NFA Number and clicks **Next**:

1. Call `ZNFA_DISPLAY_GET_API` with:
   `{ TYPE_NFA: "", ZRFQS: [{ RFQ: "" }], GET: "", REL_CODE: "", ZNFA_NUM: "<Main NFA Number>", PRINT: "" }`
2. While loading, show skeleton rows in place of the detail cards.
3. On success, reveal the detail cards populated from the response.
4. If SAP returns `STATUS: "FALSE"` (or a message instead of a `ZNFA` object), show the `MSG` text in a red alert above the cards plus a toast, and do not render empty tables.

## Field mapping

- Type of NFA = `ZNFA.TYPE_NFA`; NFA Title = `ZNFA.TITLE`; Approved Budget = `ZNFA.APP_BUDGET`; Balance Budget = `ZNFA.BAL_BUDGET`.
- RFQ Number = `ZRFQS[0].RFQ`.
- Buyer Details: Buyer Id `BUYER_ID`, Name `BUYER_NAME`, E-Mail `BUYER_EMAIL`, Location `LOCATION`.
- Scope of Work / Purchase Type: Spend Category `SPENDCATEGORY`, Item Category `ITEM_CATEGORY`, Purch. Group `EKGRP`, Remarks `REMARKS`.
- **PR DETAILS** (one row per `PR_DET`) — columns replaced to: PR No `BANFN`, PR Item `BNFPO`, Material `MATNR`, Item Text `TXZ01`, Qty `MENGE` (numeric), UOM `MEINS`, Plant `WERKS`, Plant Name `NAME1`, PR Date `PR_APP_DATE`.
- **RFQ DETAILS** (one row per `RFQ_DET`): Vendor (`NAME1` / `LIFNR`), RFQ No `ANFNR`, RFQ Item `ANFPS`, Plant (`WERKS` / `PLANT_NAME`), Material `MATNR`, Item Text `TXZ01`, Qty `ANMNG`, UOM `MEINS`, Unit Rate `FINAL_RATE`, Currency `WAERS`, Basic Value `BASIC_COST`, Tax % `TAX_PER`, Tax Value `TAX`, Total Value `TOTAL` (numerics right-aligned).
- **FINAL RECOMMENDATION** (one row per `RECOMMEND`): Vendor `LIFNR`, Name `NAME1`, Commercial Rating `VENDOR_RATE`, TER Rating `TER_RATE`, Basic Cost `BASIC_COST`, Currency `WAERS`, Tax `TAX`, Discount `DISCOUNT`, Freight `FREIGHT`, Packing & FWD `PACK_FWD`. RFQ No and Conversion Rate stay blank.
- **Attachments List** (one row per `ATTACH`): Vendor `VENDOR`, Name `NAME1`, plus a new count column from `NO_ATTACHMENTS`.
- **NFA Texts** (rows of `NFA_TEXTS` where `AVL_TEXTS` is non-empty): NFA Texts = `AVL_TEXTS`, T&C = `HEADER[0].LINE`.

Fields stay editable as they are today (no read-only pass). Release / Approved List, and the commented-out Create/Change paths, are untouched.

## Technical notes

- New server function file `src/lib/mm/znfa-display.functions.ts`, modelled on `znfa-release.functions.ts`: `requireSupabaseAuth` middleware, zod-validated `{ znfaNum }`, loads config `ZNFA_DISPLAY_GET_API` + credentials + global proxy settings, posts via middleware `/sap/invoke` when proxy mode is on, logs to `sap_api_sync_log`, and returns `{ znfa, rfqs, prDet, rfqDet, recommend, attach, nfaTexts, error, sapMessage, fetched_at }`.
- `src/routes/_authenticated/mm.znfa-release.tsx`: add a `displayMutation` (useMutation + useServerFn) called from `onDisplayNext`; on success set form state and row state; replace `PR_DETAIL_COLUMNS` with the new PR column set and add `RFQ_DETAIL_COLUMNS`; extend `DetailsTableCard` to accept `rows` and render data rows (numeric cells right-aligned) with the existing empty state as fallback; render the SAP error `Alert` above the cards; clear display data in `resetCreateForm()`.
- No schema, RLS, or business-logic changes.
