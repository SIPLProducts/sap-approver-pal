## Goal

Make the Post button on MIGO Release send exactly the updated `MIGO_POST_API` payload shape. Response handling, SweetAlert display, reset-on-success, and all other screen behaviour stay as they are.

## What changes

### 1. HEADER block (`postMigo` in `src/lib/mm/migo-release.functions.ts`)

Build the header explicitly with this fixed key set, in this order, instead of spreading whatever the fetch returned:

`DOC_DATE, PSTNG_DATE, DELIV_NOTE, VENDOR_NAME, HEADER_TEXT, POST, GAT_NO, GAT_DATE, GIR_NO, GIR_DATE, VEHICLE_NO, INVOICE_NO, TRANSPORT_NO, ZINSP, ZNSP, ZMTSNR`

- Values come from the fetched header (case-insensitive key lookup), missing keys default to `""`.
- `POST` is always `"X"`.
- The ten custom fields (`GAT_NO` … `ZMTSNR`) are filled from the Custom Fields card when the user has run Check; empty strings otherwise.

To do that, the page (`src/routes/_authenticated/mm.migo-release.tsx`) passes the current `customFields` object along with `header` into the post mutation. No UI change.

### 2. DATA rows

Each selected row is normalised to exactly the documented item keys, in order:

`MAT_DOC, DOC_YEAR, MATDOC_ITM, MATERIAL, WARRANTY, OK, PLANT, DESCRIPTION, STGE_LOC, BATCH, MOVE_TYPE, STCK_TYPE, SPEC_STOCK, VENDOR, VENDOR_NAME, CUSTOMER, SALES_ORD, S_ORD_ITEM, SCHED_LINE, ENTRY_QNT, ENTRY_UOM, PO_PR_QNT, ORDERPR_UN, PO_NUMBER, PO_ITEM, ITEM_TEXT, PROFIT_CTR, CURRENCY, REF_DOC_YR, REF_DOC, REF_DOC_IT, CMMT_ITEM_LONG, LINE_ID`

Typing rules so SAP receives numbers where the sample shows numbers:

- Numeric: `DOC_YEAR, MATDOC_ITM, S_ORD_ITEM, SCHED_LINE, ENTRY_QNT, PO_PR_QNT, PO_ITEM, REF_DOC_YR, REF_DOC_IT, LINE_ID` — coerced from the value, defaulting to `0`.
- Everything else: string, defaulting to `""`.
- User edits (STGE_LOC input, WARRANTY/OK checkboxes, STCK_TYPE dropdown) are merged in before normalisation, exactly as today.

### 3. Unchanged

- Validator still accepts `{ header, data }` (plus optional `custom`), proxy/direct dispatch, logging, and the existing response parsing that reads `type`/`message`/`mat_doc`/`doc_year` case-insensitively.
- SweetAlert message format, success reset, and column ordering remain untouched.

## Technical notes

Only two files are touched: `src/lib/mm/migo-release.functions.ts` (payload builders + optional `custom` input) and `src/routes/_authenticated/mm.migo-release.tsx` (pass `customFields` into the mutation call).
