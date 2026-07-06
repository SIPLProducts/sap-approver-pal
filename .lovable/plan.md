# Price Approval Reports screen

## 1. New route — `src/routes/_authenticated/sd.price-reports.tsx`

Duplicate the Price Approvals screen's structure (Selection card with Plant multi-select + Execute/Reset, and the Cloudscape table) with these differences:

- Page title: **Price Approval Reports**.
- Table title: **Price Approval Reports**.
- Read-only: no selection checkboxes, no Accept/Reject buttons, no `ResultDialog`. (`showSelect={false}`, omit `onAccept`/`onReject`.)
- Same 12 columns as Price Approvals, in the same order, **plus two new trailing columns**:
  - `release_code1` — header "Release Code 1"
  - `approval_status` — header "Approval Status"
- Reuses `fetchPriceApprovals` and `getMySapUserId` server functions (no new backend endpoint — the SAP `Price_Approval_Fetch` payload already contains these two fields; we just need to surface them).
- Uses `useActiveContext().activePlants` for the same top-bar plant filtering behavior.

## 2. Extend the DTO — `src/lib/sd/price-approval.functions.ts`

- Add two optional fields to `PriceRow`:
  - `release_code1: string | null`
  - `approval_status: string | null`
- In `mapRow`, add:
  - `release_code1: pick(raw, "RELEASE_CODE1")`
  - `approval_status: pick(raw, "APPROVAL_STATUS")`
- Add both to `PriceRowSchema` as `z.string().nullable().optional()` so `submitPriceDecision` keeps validating (it drops them via `toSapRow`, so no behavior change there).

No change to the submit path or SAP payload shape.

## 3. Reports button on `sd.price.tsx`

In the Selection card's action row, add a `Reports` button (outline variant, `FileText` icon from lucide) to the left of `Execute`. Clicking it navigates via `useNavigate()` to `/sd/price-reports` (Tanstack `Link`/`navigate`, not `<a href>`).

## 4. Route registration

`src/routeTree.gen.ts` is regenerated automatically — no manual edit. The new file `sd.price-reports.tsx` under `_authenticated/` uses:
```ts
createFileRoute("/_authenticated/sd/price-reports")({ component: PriceReportsPage })
```

## Out of scope

- No changes to the SAP config, middleware, or backend fetch logic.
- No changes to Contract / Sales Order / SC-SO screens.
- No permissions / role-gating changes (Reports button visible to any user who can see Price Approvals; adjust later if you want it role-restricted).

## Verification

1. Click **Reports** on `/sd/price` → routes to `/sd/price-reports` with title "Price Approval Reports".
2. Pick plant(s) → **Execute** → table renders all original columns plus **Release Code 1** and **Approval Status** on the right; no Accept/Reject buttons; no row checkboxes.
3. `/sd/price` still works unchanged (accept/reject flow intact).
