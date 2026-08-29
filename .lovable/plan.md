# ZNFA Rating attachment preview + MIGO field labels

## 1. ZNFA Rating — Object Description hyperlink

In the Attachments result table (ZNFA Rating / Gate Process), Object Description becomes a clickable link. Clicking it calls the same `ZNFA_ATTACH_PRINT_API` used in ZNFA Release and opens the same document preview dialog (PDF in iframe, images inline, Open in new tab + Download, loading and error states).

Technical:
- `src/lib/mm/gate-process.functions.ts`: the attachments mapping currently keeps only `OBJDES`, `OWNNAM`, `CRDAT`, so the keys the print API needs (e.g. `IF_DOC_BCS` / `IF_DOC_CLS`) are dropped. Keep the three existing display fields exactly as-is and additionally carry the untouched SAP row (spread the raw row alongside, plus the raw `CRDAT` preserved for the payload) so the print call can send the row verbatim. Type `ZnfaAttachment` widened with an index signature.
- `src/routes/_authenticated/mm.gate-process.tsx`: reuse `fetchZnfaAttachPrint` from `src/lib/mm/znfa-attach.functions.ts` with the same state, blob-URL effect, mutation and Dialog markup as `mm.znfa-release.tsx`. Object Description cell renders as a link button; empty value stays "—" and non-clickable.
- No change to the attachments fetch, rating/change/display/save flows, or the Created By / Created Date columns.

## 2. MIGO Release — display labels only

Rename displayed labels (data, payloads and keys unchanged):

Header: DOC_DATE → Document Date, PSTNG_DATE → Posting Date, DELIV_NOTE → Delivery Note Number, VENDOR_NAME → Vendor Name, HEADER_TEXT → Header Text.

Check response: GAT_NO → Gate Entry Number, GAT_DATE → Gate Entry Date, GIR_NO → Goods Inspection Report Number, GIR_DATE → Goods Inspection Report Date, VEHICLE_NO → Vehicle Number, INVOICE_NO → Invoice Number, TRANSPORT_NO → Transport Number, ZINSP → Inspection Date, ZNSP → Inspection Status, ZMTSNR → Material Test Serial Number.

Data table: MAT_DOC → Material Document Number, DOC_YEAR → Material Document Year, MATDOC_ITM → Material Document Item, MATERIAL → Material Number, WARRANTY → Warranty Information, OK → Selection Indicator, PLANT → Plant, DESCRIPTION → Material Description, STGE_LOC → Storage Location, BATCH → Batch Number, MOVE_TYPE → Movement Type, STCK_TYPE → Stock Type, SPEC_STOCK → Special Stock Indicator, VENDOR → Vendor Number, VENDOR_NAME → Vendor Name, CUSTOMER → Customer Number, SALES_ORD → Sales Order Number, S_ORD_ITEM → Sales Order Item, SCHED_LINE → Schedule Line, ENTRY_QNT → Entry Quantity, ENTRY_UOM → Unit of Measure, PO_PR_QNT → Purchase Order Quantity, ORDERPR_UN → Purchase Order Unit, PO_NUMBER → Purchase Order Number, PO_ITEM → Purchase Order Item, ITEM_TEXT → Item Text, PROFIT_CTR → Profit Center, CURRENCY → Currency, REF_DOC_YR → Reference Document Year, REF_DOC → Reference Material Document, REF_DOC_IT → Reference Document Item, CMMT_ITEM_LONG → Commitment Item, LINE_ID → Line.

Technical: add a label map in `src/routes/_authenticated/mm.migo-release.tsx` and use it for header field labels, custom-fields labels and column headers, falling back to the current `key.replace(/_/g, " ")` for any key not listed. Ordering, editing, selection, post/check logic untouched.

## Verification
- Build/typecheck, then check ZNFA Rating attachments preview opens a document and MIGO labels render.
