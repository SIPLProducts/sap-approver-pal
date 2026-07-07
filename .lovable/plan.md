## Goal

On **Contract Approval Reports** and **Sales Order Approval Reports**, always show four SAP fields as columns with the exact API keys and user-specified labels, even when the values are empty:

| API key (DATA[].KEY) | Column label      |
| -------------------- | ----------------- |
| `REL_1`              | Release Code 1    |
| `STATUS_1`           | Status 1          |
| `REL_2`              | Release Code 2    |
| `STATUS_2`           | Status 2          |

Today `buildDynamicColumns()` drops any column whose value is empty across every row, so these fields disappear whenever SAP returns blanks. They also get generic auto-prettified headers ("Rel 1"). Both need to be overridable per screen.

## Changes

### 1. `src/lib/sd/dynamic-columns.tsx`

Extend `DynamicOptions`:

- `alwaysInclude?: string[]` — keys that must appear as columns even when every row is empty. They render `"—"` for empty cells like other columns.
- `headerLabels?: Record<string, string>` — override the auto-prettified header per key.

Implementation:

- Build the key union as today. Then merge in `alwaysInclude` keys that aren't already present (appended at the end, order preserved).
- Skip the "drop empty" filter for keys in `alwaysInclude`.
- When computing each column's `header`, use `headerLabels[key] ?? prettify(key)`.
- `REL_1`/`STATUS_1`/`REL_2`/`STATUS_2` are already in `FORCE_TEXT_KEYS`, so alignment/width logic is unchanged.

### 2. `src/routes/_authenticated/sd.contract-reports.tsx`

Change the single call:

```tsx
columns={buildDynamicColumns(rows)}
```

to:

```tsx
columns={buildDynamicColumns(rows, {
  alwaysInclude: ["rel_1", "status_1", "rel_2", "status_2"],
  headerLabels: {
    rel_1: "Release Code 1",
    status_1: "Status 1",
    rel_2: "Release Code 2",
    status_2: "Status 2",
  },
})}
```

Row mapping already lowercases `REL_1`→`rel_1` etc. via the existing `mapRow` in `contract-approval.functions.ts`, so no server changes.

### 3. `src/routes/_authenticated/sd.sales-order-reports.tsx`

Same change as above. `sales-order-approval.functions.ts` already maps these four SAP fields into the row, so no server changes.

## Out of scope

- No changes to the approval (non-reports) screens, other SD tables, server functions, filters, or row shapes.
- No sort/filter behavior changes.

## Verification

- `tsgo` typecheck.
- Load Contract Reports and Sales Order Reports with a payload where SAP returns blank REL/STATUS fields — the four columns must still appear with the specified labels and `"—"` cells. When SAP returns values, they must render verbatim.
