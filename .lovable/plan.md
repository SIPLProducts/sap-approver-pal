## Goal

Across all SD approval tables (interactive + reports): (1) remove sort arrows from every column header, and (2) render columns dynamically from the fields actually present in the API response, dropping any that are empty for every row.

## Changes

### 1. `src/components/aws/cloudscape-approval-table.tsx`
- In the `columnDefinitions` mapper, force `sortingField: undefined` for every user-supplied column and every internal (reason) column. Sort arrows disappear table-wide with no per-screen change.
- Keep `resizableColumns` and everything else.

### 2. New helper: `src/lib/sd/dynamic-columns.tsx`
- Export `buildDynamicColumns<T>(rows, options?)` that:
  - Collects the union of keys across all rows (preserving first-seen order from row 0, then any additional keys from later rows).
  - Skips reserved keys: `select`, `__key`, plus any key listed in `options.exclude`.
  - Drops keys whose value is null/undefined/`""` in every row.
  - Builds a `CloudscapeColumn<T>` per remaining key:
    - `header`: prettified (`customer_name` → `Customer Name`, `rel_1` → `Rel 1`, all-caps segments preserved).
    - `cell`: uses shared formatters — number-like values get `toLocaleString("en-IN", …)` with right alignment; SAP date strings (`YYYYMMDD` or ISO) get `dd.mm.yyyy`; everything else renders as string, `—` for empty.
  - `align: "right"` when the column is detected numeric (majority of non-empty rows parse as finite numbers).

### 3. Wire the helper into every SD table
Replace the hand-written `columns={[…]}` prop on these files with `columns={buildDynamicColumns(rows)}`:
- `src/routes/_authenticated/sd.contract.tsx`
- `src/routes/_authenticated/sd.contract-reports.tsx`
- `src/routes/_authenticated/sd.sales-order.tsx`
- `src/routes/_authenticated/sd.sales-order-reports.tsx`
- `src/routes/_authenticated/sd.sc-so.tsx`
- `src/routes/_authenticated/sd.sc-so-reports.tsx`
- `src/routes/_authenticated/sd.price.tsx`
- `src/routes/_authenticated/sd.price-reports.tsx`
- `src/routes/_authenticated/sd.bmw-status.tsx`

Selection (checkbox) column, reason column, and header actions on interactive screens continue to come from `showSelect` / `showReason` / `readonlyReason` props on `CloudscapeApprovalTable` — those are unaffected.

## Out of scope

- Dashboards, charts, KPI cards. No change to non-table SD views.
- Server function payloads, request shapes, mappers. `mapRow` in each `*.functions.ts` stays as-is; the dynamic column builder reads whatever shape the row already has.
- No change to filter search bar, pagination, or row selection behavior.
- No change to inbox / approval detail / history / admin tables.

## Verification

- Load each SD table, run Execute → columns match the fields the current SAP response actually returned; empty columns are gone; no sort arrows on any header.
- Interactive screens (`sd.contract`, `sd.sales-order`, `sd.sc-so`, `sd.price`) still show the selection checkboxes and reason column and can approve/reject.
- Build + typecheck clean.
