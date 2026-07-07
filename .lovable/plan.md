## Objective
Redesign `src/routes/_authenticated/sd/dashboard.tsx` into a visually polished, modern analytics dashboard that draws exclusively from the live BMW Status Report API (`fetchBmwStatusReport`, mode `"sales"` — the widest schema). No dummy data, no selection form, no Execute button. Uses the active plants from the top bar (unchanged behavior).

## Data source
Same server fn `fetchBmwStatusReport` already wired. Mode = `sales` gives the full schema (Core + BP + MBD + Contract + Contract Releases `_C` + PH + Service Cert + PH Sales + Sales + Sales Releases + Billing), so every KPI/chart below reads real SAP fields.

## Visual direction
- Gradient hero header with plant-range chip, last-refreshed time, manual Refresh button (icon only), and live record count pill.
- Semantic tokens only (no hardcoded colors). Add a small gradient token set locally via inline `style={{ background: "var(--gradient-primary)" }}` where a KPI card needs a hero surface — no `styles.css` edits required (existing `--gradient-primary`, `--gradient-gold`, `--shadow-elegant` are already defined per `KpiTile`).
- Cards use `shadow-card`/`shadow-elegant`, rounded-xl, subtle border, hover lift.
- Consistent chart palette using `CHART_COLORS` (already themed via HSL tokens).
- Tooltip + legend styled to match card surface.
- Skeleton loaders (shimmer) for KPIs and charts instead of a bare spinner.
- Fully responsive: 2-col KPI on mobile, 4-col on lg, 6-col hero row on xl; charts stack to 1-col on mobile.

## Layout
```
[ Hero header: title · plant chip · refreshed · Refresh btn ]

[ KPI row  (6 tiles, xl) ]
 Records | Customers | Contracts | Sales Orders | Contract Net Value | Sales Net Value
  (lead)   (info)      (gold)      (success)      (primary gradient)   (warning)

[ Row A  (lg: 2 + 1) ]
 Top 10 Customers by Contract Value  (horizontal bar, gradient bars)
 BP Status donut (Active vs Inactive) with center total

[ Row B  (lg: 1 + 1) ]
 Contracts vs Sales Orders — last 12 months  (stacked/area line combo)
 Records by Sales Org (colored bar)

[ Row C  (lg: 2 + 1) ]
 Contract Release Pipeline — stacked bar of STATUS_1_C…STATUS_8_C
   (counts of Pending / Approved / Rejected per release level)
 Approval Throughput donut — PH_STATUS distribution (Pending / Approved / Rejected / Other)

[ Row D  (lg: 1 + 1) ]
 Top 8 Materials by Contract Net Value (vertical bar)
 Division / Distribution Channel split (grouped bar or treemap-style bar)

[ Footer strip: small tiles — Billing Docs count · Accounting Docs count · Service Certs count · Avg Contract Value ]
```

## KPIs (all derived from live rows)
- Records — `rows.length`
- Customers — unique `CUSTOMER`
- Contracts — unique `CONTRACT_NO`
- Sales Orders — unique `SALES_ORDER_NO`
- Contract Net Value — Σ `CONTRACT_NET_VALUE || NET_VALUE`
- Sales Net Value — Σ `SALES_NET_VALUE`

Footer micro-KPIs:
- Billing Docs — unique non-empty `BILLING_DOC`
- Accounting Docs — unique non-empty `ACCOUNTING_DOC`
- Service Certs — unique non-empty `SERVICE_CERT_NO`
- Avg Contract Value — Σ contract net / unique contracts

## Charts (all real SAP fields)
1. Top 10 Customers by Contract Value — aggregate `CONTRACT_NET_VALUE` grouped by `CUSTOMER`, label from `CUSTOMER_NAME`.
2. BP Status donut — `BP_ACTIVE_INACTIVE` per unique customer (`"01"` = Active, else Inactive).
3. Contracts vs Sales Orders by month — parse `CONTRACT_DATE` / `CONTRACT_CREATE_DATE` and `SALES_CREATE_DATE`, count unique contracts / sales orders per YYYY-MM, last 12 months.
4. Records by Sales Org — count rows per `SALES_ORG`.
5. Contract Release Pipeline — for each `n` in 1..8, count STATUS_n_C values bucketed as Pending / Approved / Rejected / Other, rendered as stacked bar (x = Release level, stacks = status). Skips release levels with zero rows to keep it clean.
6. Approval Throughput donut — `PH_STATUS` bucketed the same way.
7. Top 8 Materials — aggregate `CONTRACT_NET_VALUE` by `MATERIAL_CODE`.
8. Division / Dist Channel split — grouped bar: for each `DIVISION`, count rows per `DIS_CHANNEL` (or vice versa, whichever has fewer distinct keys, capped at top 6 × top 4).

## Interaction & polish
- Manual "Refresh" button calls `query.refetch()`; disabled while fetching.
- `query.dataUpdatedAt` → formatted "Updated 2m ago" chip.
- Empty state per card: friendly icon + one-line message (unchanged pattern).
- No selection screen, no radio buttons, no execute button — active plants from top bar remain the only input, exactly like the current dashboard.
- Preserve existing route path and nav entry — no changes needed in `_authenticated.tsx` or `routeTree.gen.ts`.

## Files to change
- `src/routes/_authenticated/sd.dashboard.tsx` — full rewrite of the component (single-file change). All aggregation happens client-side in one `useMemo` over the fetched rows.

## Out of scope
- No changes to `fetchBmwStatusReport` (server fn stays as-is).
- No changes to BMW Status Report screen, nav, or any other route.
- No new global CSS tokens — uses existing semantic tokens and `KpiTile` accents.
