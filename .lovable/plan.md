# Fix BMW Status Report — bind real SAP response keys

## Root cause

The server function (`src/lib/sd/bmw-status-report.functions.ts`) already returns the raw SAP `DATA[]` rows — no dummy data is generated anywhere. The table appears empty/placeholder because `COLUMN_SCHEMA` in `src/routes/_authenticated/sd.bmw-status.tsx` uses **invented column keys** (e.g. `BP_SRV_VALID_FROM`, `BP_NO_BEDS_INVOICE`, `NET_VALUE`, `CON_SRV_VALID_FROM`) that don't exist in the SAP payload. Every cell falls through to `—`. The schema is also single (Customer-only) — Contract / Sales mode rows have dozens of unmapped fields (`REL_1`…`REL_8`, `PH_*`, `SERVICE_CERT_NO`, `SALES_ORDER_NO`, `BILLING_DOC`, etc.).

## Changes (UI only — `src/routes/_authenticated/sd.bmw-status.tsx`)

### 1. Replace `COLUMN_SCHEMA` with three mode-aware schemas

Use the **exact SAP keys** from the response sample the user shared.

**`CUSTOMER_SCHEMA`** — Core + BP + MBD + Contract basics:
```text
Core:     COMPANY_CODE, SALES_ORG, CUSTOMER, CUSTOMER_NAME, DIS_CHANNEL, DIVISION
BP:       BP_CUS_GROUP, BP_PRICE_GROUP,
          BP_SERVICE_VALID_FROM, BP_SERVICE_VALID_TO,
          BP_SERVICE_START_DATE, BP_REGISTRATION_DATE,
          BP_UPPER_SLAB, BP_NO_BEDS_INVOICED,
          BP_AGREEMENT_VALID_FROM, BP_AGREEMENT_VALID_TO,
          BP_ACTIVE_INACTIVE, BP_FIXED_RATE, BP_PER_BED_RATE, BP_EXCESS_QTY_RATE
MBD:      MBD_ID, MBD_NAME
Contract: CONTRACT_NO, CONTRACT_ITEM, CONT_CREATION_DATE, CONT_CREATED_BY,
          MATERIAL_CODE, CONTRACT_NET_VALUE, CONTRACT_TAX, CONTRACT_TOTAL,
          CON_CUS_GROUP, CON_PRICE_GROUP,
          CON_SERVICE_VALID_FROM, CON_SERVICE_VALID_TO,
          CON_SERVICE_START_DATE, CON_REGISTRATION_DATE,
          CON_UPPER_SLAB, CON_NO_BEDS_INVOICED,
          CON_AGREEMENT_VALID_FROM, CON_AGREEMENT_VALID_TO,
          CON_ACTIVE_INACTIVE, CON_FIXED_RATE, CON_PER_BED_RATE, CON_EXCESS_QTY_RATE
```

**`CONTRACT_SCHEMA`** = `CUSTOMER_SCHEMA` + Contract Releases (`REL_{n}_C`, `STATUS_{n}_C`, `APP_REJ_DATE{n}_C`, `APP_REJ_REASON{n}_C` for n=1..8) + PH approval (`PH_APPROVE_TYPE`, `PH_INITIATED_ID`, `PH_NAME`, `PH_INITIATED_DATE`, `PH_STATUS`, `PH_APPROVE_DATE`, `PH_REASON`) + Service Certificate (`SERVICE_CERT_NO`, `SERVICE_VALID_FROM`, `SERVICE_VALID_TO`, `ISSUE_DATE`, `ISSUE_ID`).

**`SALES_SCHEMA`** = `CONTRACT_SCHEMA` + PH Sales (`PH_SALES_APPR_TYPE`, `PH_SALES_INIT_ID`, `PH_SALES_NAME`, `PH_SALES_INIT_DATE`, `PH_SALES_STATUS`, `PH_SALES_APPR_DATE`) + Sales Order (`SALES_ORDER_NO`, `SALES_ITEM`, `SALES_CREATE_DATE`, `SALES_CREATED_BY`, `SALES_MATERIAL`, `SALES_NET_VALUE`, `SALES_TAX`, `SALES_TOTAL`) + Sales Releases (`REL_{n}`, `STATUS_{n}`, `APP_REJ_DATE{n}`, `APP_REJ_REASON{n}` for n=1..8) + Billing (`BILLING_DOC`, `ACCOUNTING_DOC`).

Build the 1..8 release columns with a small helper so the schema stays compact.

### 2. Pick the active schema from the fetched mode

Store the mode that came back with the response (`res.mode`) in state alongside `rows`, and select `SCHEMAS[activeMode]` for rendering. Changing the radio after Execute does **not** reshape the already-loaded table — only re-Execute does.

### 3. Group metadata + header rendering

Extend `ColGroup` with `mbd`, `release_c`, `ph`, `service_cert`, `ph_sales`, `sales`, `release_s`, `billing`. Give each a label and a distinct subtle background in `GROUP_META`. The two-row `<thead>` already supports groups; iterate the active schema's groups in order and compute `colSpan` from adjacent same-group columns. Keep the sticky header, wrap the table with `min-w-max` inside the existing `overflow-auto` scroll container so the wide Sales schema scrolls horizontally without collapsing columns.

### 4. Types / formatters

Reuse existing `text | date | decimal3 | currency2 | int | status` types. Money fields (`CONTRACT_NET_VALUE`, `CONTRACT_TAX`, `CONTRACT_TOTAL`, `SALES_NET_VALUE`, `SALES_TAX`, `SALES_TOTAL`, rate fields) → `currency2`. Slab / per-bed-rate / fixed-rate / excess-qty-rate → `decimal3`. Item counts / beds → `int`. All `*_DATE` / `*_VALID_FROM` / `*_VALID_TO` → `date` (existing `formatDate` already turns `0000-00-00` into `—`). `BP_ACTIVE_INACTIVE` / `CON_ACTIVE_INACTIVE` → `status` (`01` = Active).

## Out of scope

- No server-function changes — payload already echoes `mode` and forwards real SAP rows. If `res.mode` is missing on older responses, fall back to the form's `mode` at fetch time (already in state).
- No changes to other SD screens, layout, or styling system.
- No new column types.

## Verification

1. Execute with Customer mode → BP + MBD + Contract basic columns populate from real keys (no `—` for fields SAP returned).
2. Switch to Contract mode + Execute → Contract Releases 1–8, PH, Service Certificate groups appear and fill.
3. Switch to Sales mode + Execute → Sales Order, PH Sales, Sales Releases 1–8, Billing groups appear and fill; table scrolls horizontally.
