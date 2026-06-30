# Plan: Mode-Aware Column Schema for BMW Status Report

The current table renders a fixed schema oriented at Customer-wise output. When the user selects **Contract-wise** or **Sales-wise**, SAP returns a much larger row (release codes 1–8 for contract & sales, PH approval block, service certificate, sales order block, billing/accounting). The table should expand to show all of these — grouped, typed, and labeled to match the attached spec — and the visible column set should switch with the active radio button.

## Changes

### 1. `src/routes/_authenticated/sd.bmw-status.tsx`

**Restructure `COLUMN_SCHEMA` into mode-aware schemas.** Replace the single static array with:

```text
SCHEMAS = {
  customer: ColDef[]  // current schema (Core + BP + Contract basics)
  contract: ColDef[]  // full contract output
  sales:    ColDef[]  // full sales output
}
```

Pick the active schema from the response's `mode` (passed through from the form). Persist the mode used at fetch time alongside `result` so changing the radio after execute doesn't reshape the already-loaded table until re-Executed.

**Add new column groups + `ColType`s:**

- New groups: `release_c` (Contract releases 1–8), `ph` (Pricing Head approval), `service_cert` (Service Certificate), `ph_sales` (PH Sales approval), `sales` (Sales Order header/item), `release_s` (Sales releases 1–8), `billing` (Billing & Accounting).
- New `ColType` value: `int` already exists; reuse for `CONTRACT_ITEM`, `SALES_ITEM`. Add no new types.

**Contract-wise extra columns (appended after current Contract group):**

```text
Contract Releases 1..8 (group "Contract Releases"):
  REL_{n}_C         text   "Release Code {n}"
  STATUS_{n}_C      text   "Status {n}"
  APP_REJ_DATE{n}_C date   "Date {n}"
  APP_REJ_REASON{n}_C text "Reason {n}"

PH Approval (group "Pricing Head"):
  PH_APPROVE_TYPE   text   "PH Approve Type"
  PH_INITIATED_ID   text   "PH Initiated ID"
  PH_NAME           text   "PH Name"
  PH_INITIATED_DATE date   "PH Initiated Date"
  PH_STATUS         text   "PH Status"
  PH_APPROVE_DATE   date   "PH Approve Date"
  PH_REASON         text   "PH Reason"

Service Certificate (group "Service Certificate"):
  SERVICE_CERT_NO     text "Cert No"
  SERVICE_VALID_FROM  date "Valid From"
  SERVICE_VALID_TO    date "Valid To"
  ISSUE_DATE          date "Issue Date"
  ISSUE_ID            text "Issue ID"
```

**Sales-wise extra columns** (Sales schema = everything in Contract schema **plus** the following appended):

```text
PH Sales Approval (group "PH Sales"):
  PH_SALES_APPR_TYPE  text "Approve Type"
  PH_SALES_INIT_ID    text "Initiated ID"
  PH_SALES_NAME       text "Name"
  PH_SALES_INIT_DATE  date "Initiated Date"
  PH_SALES_STATUS     text "Status"
  PH_SALES_APPR_DATE  date "Approve Date"

Sales Order (group "Sales Order"):
  SALES_ORDER_NO      text     "Sales Order No"
  SALES_ITEM          int      "Item"
  SALES_CREATE_DATE   date     "Creation Date"
  SALES_CREATED_BY    text     "Created By"
  SALES_MATERIAL      text     "Material Code"
  SALES_NET_VALUE     currency2 "Net Value"
  SALES_TAX           currency2 "Tax"
  SALES_TOTAL         currency2 "Total"

Sales Releases 1..8 (group "Sales Releases"):
  REL_{n}             text   "Release Code {n}"
  STATUS_{n}          text   "Status {n}"
  APP_REJ_DATE{n}     date   "Date {n}"
  APP_REJ_REASON{n}   text   "Reason {n}"

Billing (group "Billing"):
  BILLING_DOC         text "Billing Doc"
  ACCOUNTING_DOC      text "Accounting Doc"
```

**Group metadata updates (`GROUP_META`):** add labels and a distinct subtle background per new group so the two-row header stays readable across the wide table. Order in header = order columns appear.

**Other touches:**
- The first `<thead>` row already spans groups; widen the loop to walk the active schema's groups in order, computing `colSpan` from adjacent same-group columns.
- Keep sticky header. Wide table → ensure parent has `overflow-x-auto` (already present) and add `min-w-max` to the `<table>` so columns don't collapse.
- `Active/Inactive` status badge logic stays for both BP and Con columns.

### 2. `src/lib/sd/bmw-status-report.functions.ts`

Echo the request `mode` back in the response so the UI can lock the schema to what was actually fetched:

```text
return { rows, columns, mode: data.mode, fetched_at, count, error }
```

No other server changes — payload already supports `R_CUS` / `R_CONT` / `R_SALES`.

## Out of scope

- No new screens, no styling system changes, no other SD screens.
- `MBD_ID` / `MBD_NAME` are in the Customer schema already — no change.
- Duplicate `Cont.Created By` / `Sales.Created By` lines in the spec are treated as a single column each (SAP returns one key).

## Technical notes

- SAP returns release-code numerics as space-padded strings; existing `formatNumber` already trims.
- `APP_REJ_DATE*` use `0000-00-00` for empty → existing `isEmpty` + `formatDate` handles it.
- `CONTRACT_ITEM` / `SALES_ITEM` arrive as JSON numbers; cast via `String(v)` before parse in `int` renderer (already done).
- Sales schema is a superset of Contract schema — define Sales as `[...CONTRACT_SCHEMA, ...salesOnly]` to avoid drift.
