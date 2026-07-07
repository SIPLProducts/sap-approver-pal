### Add Reports button and report pages to three more SD approval screens

Mirror the Price Approval / Price Approval Reports pattern for the three remaining SD approval screens.

**Screens affected**
- Contract Approvals (`/sd/contract` → new `/sd/contract-reports`)
- Service Certificate & SO Approvals (`/sd/sc-so` → new `/sd/sc-so-reports`)
- Sales Order Approvals (`/sd/sales-order` → new `/sd/sales-order-reports`)

**Changes**

1. **Add a `Reports` button on each source screen** (`sd.contract.tsx`, `sd.sc-so.tsx`, `sd.sales-order.tsx`)
   - Import `FileText` from `lucide-react` and `useNavigate` from `@tanstack/react-router` (if not already imported).
   - Add an outline `Reports` button next to `Execute` / `Reset` in the selection action row.
   - On click: `navigate({ to: "/sd/contract-reports" | "/sd/sc-so-reports" | "/sd/sales-order-reports" })`.

2. **Create three new report route files** — one per screen, using the exact same design as `sd.price-reports.tsx`:
   - `src/routes/_authenticated/sd.contract-reports.tsx` — title `Contract Approval Reports`, back arrow → `/sd/contract`
   - `src/routes/_authenticated/sd.sc-so-reports.tsx` — title `Service Certificate & SO Approval Reports`, back arrow → `/sd/sc-so`
   - `src/routes/_authenticated/sd.sales-order-reports.tsx` — title `Sales Order Approval Reports`, back arrow → `/sd/sales-order`

   Each report page:
   - Reuses the same fetch server function and `getMySapUserId` used by its source screen.
   - Reuses the same selection screen (Plant multi-select, Execute, Reset) and `CloudscapeApprovalTable`.
   - Displays the **same columns** as the source screen — read-only (no accept/reject, no selection).
   - Has a back-arrow icon button beside the title that navigates back to the source screen.
   - Uses `useActiveContext()` for default plants, same as the price report.

**Out of scope**
- No new columns are added for these three screens (unlike Price where `RELEASE_CODE1` / `APPROVAL_STATUS` were added — the user did not ask for extra columns here).
- No changes to server functions, row types, or the source approval screens' data logic.

**Verification**
- `/sd/contract`, `/sd/sc-so`, `/sd/sales-order` each show a `Reports` button.
- Clicking it navigates to the corresponding new report page with matching layout and column set.
- Back arrow on each report page returns to its source screen.
- `bun run build` passes.
