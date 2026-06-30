# Plan: BMW Status Report screen (SD module)

Add a new report screen under SD Approvals, placed after "Sales Order Approvals" in the sidebar. Reuses the existing `approvals.inbox.sd` permission, so no DB or screen-keys changes.

## 1. New server function — `src/lib/sd/bmw-status-report.functions.ts`

`fetchBmwStatusReport` (createServerFn POST, `requireSupabaseAuth`):
- Inputs: `plants: string[]`, `selection: "customer" | "contract" | "sales"`, `customer?: string`, `contract?: string`, `sales_document?: string`.
- Loads the SAP API config named `BMW_Status_Report` (case-insensitive, `is_active`).
- Builds payload `{ PLANT: plants.map(p => ({ plant: p })), SELECTION: <code>, CUSTOMER, CONTRACT, SALES_DOCUMENT, USER_ID }` (middleware will collapse single-plant arrays as it already does for other SD calls).
- Calls SAP via the existing `runSapApi` helper / shared executor used by the other SD functions, returns `{ rows, error, fetched_at, debug }`.
- If the config is missing/inactive, returns `{ rows: [], error: "BMW_Status_Report API is not configured in SAP API Settings" }` instead of throwing — keeps the screen usable until an admin wires it.

## 2. New route — `src/routes/_authenticated/sd.bmw-status-report.tsx`

File path maps to URL `/sd/bmw-status-report`, route id `/_authenticated/sd/bmw-status-report`.

Layout mirrors `sd.sales-order.tsx` selection card:

- Title: "BMW Status Report", subtitle "Fetch BMW status data live from SAP via BMW_Status_Report.", badge `ZBMW_STATUS_RPT`.
- Selection card grid (`md:grid-cols-3 lg:grid-cols-5`) fields:
  - **Sales Organization** *(required)* — `PlantMultiSelect` (this is the F4 Plant helper already used across SD; same component, same label semantics).
  - **Customer** — `<Input>` (enabled only when selection = customer).
  - **Contract Number** — `<Input>` (enabled only when selection = contract).
  - **Sales Document** — `<Input>` (enabled only when selection = sales). Shown only when "Sales-wise" is chosen; hidden in the other two modes to keep the grid tidy. (Field added implicitly by the "Sales-wise" radio — user didn't list it but the radio needs an input.)
  - Execute + Reset buttons.
- Radio row below the grid (same divider treatment as Sales Order screen) with three options:
  - Customer-wise Selection (default)
  - Contract-wise Selection
  - Sales-wise Selection
  - Switching the radio clears the other inputs and disables them.
- Execute disabled until at least one plant is chosen AND the active selection field is non-empty.

### Result table

`Card` with horizontal scroll, sticky header, max-h-[60vh]. Columns (in the exact order the user listed):

```
Company Code, Sales Organization, Customer Number, Customer Name,
Distribution Channel, Division, BP Customer Group, BP Price Group,
BP Service Valid From, BP Service Valid To, BP Service Start Date,
BP Registration Date, BP Upper Slab Qty, BP Beds to Invoice,
BP Agreement Valid From, BP Agreement Valid To, BP Active/Inactive,
BP Fixed Rate, BP Per Bed Rate, BP Excess Qty Rate,
Contract Number, Contract Item No, Contract Creation Date, Contract Created By,
Material Code, Net Value, Tax Amount, Total Amount,
Contract Customer Group, Contract Price Group,
Contract Service Valid From, Contract Service Valid To,
Contract Service Start Date, Contract Registration Date,
Contract Upper Slab Qty, Contract Beds to Invoice,
Contract Agreement Valid From, Contract Agreement Valid To,
Contract Active/Inactive, Contract Fixed Rate,
Contract Per Bed Rate, Contract Excess Qty Rate
```

Each column maps to a SAP field key (e.g. `BUKRS`, `VKORG`, `KUNNR`, `NAME1`, `VTWEG`, `SPART`, `KDGRP`, `KONDA`, `ZZ_BP_SERV_FROM`, etc.). Since SAP field names aren't confirmed, the row renderer reads each cell via a `pick(row, [...candidateKeys])` helper that tries common SAP aliases and falls back to `—`. Dates use the existing `fmtDate` helper (DDMMYYYY/ISO), numbers use `fmtNum`.

Table header sticky, monospaced cells for codes, right-aligned for numeric columns. Empty state and loading spinner match the Sales Order screen.

## 3. Sidebar entry — `src/routes/_authenticated.tsx`

Append one item to the `sdChildren` array (after Sales Order Approvals):

```ts
{ to: "/sd/bmw-status-report", label: "BMW Status Report",
  icon: FileBarChart, screen: "approvals.inbox.sd" },
```

Import `FileBarChart` from `lucide-react`. No other layout changes.

## 4. No other changes

- No DB migration, no screen-keys edit, no permission table change — reuses `approvals.inbox.sd`.
- No edits to existing SD screens or `PlantMultiSelect`.
- Admin still needs to create a SAP API config named `BMW_Status_Report` (Get + payload mapping) in **SAP API Settings** before Execute returns data; until then the screen renders an inline "API not configured" notice.

## Risks / open items

- SAP response field names are unknown; the renderer uses tolerant key lookup. Once you share a sample payload I can tighten the mappings.
- "Sales-wise Selection" requires a Sales Document input — added implicitly. If you'd rather it filter by something else (e.g. date range), say so.
