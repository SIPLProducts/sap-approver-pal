## Goal
Add a "SD Approvals" expandable section in the sidebar with four sub-screens. Each screen models the corresponding SAP T-code (filter panel + Pending/Accepted/Rejected tabs + columnar data table + bulk Approve/Reject actions).

## New sidebar structure
SD Approvals (group, expandable) — replaces the single `/inbox/sd` link
- Price Approvals → `/sd/price` (ZBMW_VK11_APP, single level)
- Contract Approvals → `/sd/contract` (ZBMW_CONTRACT_APP, 2 levels)
- Service Certificate & SO Approvals → `/sd/sc-so` (ZBMW_SC_ISSUE_PH, single level, two modes via checkbox)
- Sales Order Approvals → `/sd/sales-order` (ZSD_BMW_SO_APP)

The existing combined `/inbox/sd` route stays for back-compat (kept reachable, not in nav).

## Screen pattern (shared)
Each screen uses the same shell:
1. **Header** — title, T-code chip, "Levels of approval" badge.
2. **Filter card** — Plant, Customer No (and Sold-to / approval-type checkboxes where the SAP screen has them); Action radios: Pending / Accepted / Rejected.
3. **Tabs** bound to the Action filter (Pending shows checkboxes + Approve/Reject bulk bar; Accepted/Rejected are read-only).
4. **Data table** — horizontally scrollable, sticky first column, columns sourced from the SAP output exactly:
   - **Price**: Plant, Sales Org, Material, Customer, **Customer Name** (new column called out in doc), Condition, Amount, Valid From/To, Created By, Status.
   - **Contract**: Customer, Customer Name, Contract No, Creation Date, Material, Fixed Rate, No Of Beds To Be Inv, Per Bed Rate, Net Value, Tax Value, Total Agreement, From/To Agreement, Service Valid From/To, Service Start, Registration Date, Upper Slab, Excess Qty, Rate, Dist Channel, Division, Customer Group, Customer Price Group, Contract Item, Sales Org, Company Code, Year, Reason.
   - **SC & SO**: top toggle (Service Certificate Approvals / Sales Order Approvals checkboxes). Columns: Company Code, Sales Org, Customer, Customer Name, Year, Contract No, Contract Item, Contract Ref No, Contract Ref Date, Creation Date, Contract Start/End, Down Pay Req Amount, Adv Doc Num, Adv Amount, Profit Center, Clearing Doc.
   - **Sales Order**: Sales Org, Plant, Sold-to, Customer Name, SO No, SO Date, Material, Qty, Net Value, Tax, Total, Delivery Date, Status.
5. **Row actions** — Approve (toast "Contract Rejected/Approved Successfully – {doc no}" pattern from doc), Reject (opens reason dialog; reason mandatory; 2-level docs show "Pending L2" after L1 approve).
6. **Detail drawer** — slide-over with all SAP fields grouped (Header / Financials / Validity / Classification / Reason).

## Data
Reuse existing tables `approval_documents` + `approval_steps` + doc_type enum values already present (`BMW_PRICE`, `BMW_CONTRACT`, `BMW_SO`, `BMW_SC_ISSUE`). Each screen queries by `doc_type` and joins steps to drive Pending/Accepted/Rejected tabs and current step seq. No schema changes.

Approve / Reject use the same RPC pattern already in `approval.$id.tsx` (insert into `approval_steps`, advance `current_step_seq`, write `notifications`). 2-level Contract sets next step on first approve.

## Files
- New: `src/routes/_authenticated/sd.price.tsx`
- New: `src/routes/_authenticated/sd.contract.tsx`
- New: `src/routes/_authenticated/sd.sc-so.tsx`
- New: `src/routes/_authenticated/sd.sales-order.tsx`
- New: `src/components/sd/sd-approval-shell.tsx` — shared filter/tabs/table shell.
- New: `src/components/sd/sd-row-actions.tsx` — approve/reject + reason dialog.
- New: `src/lib/sd/sd.functions.ts` — `listSdDocs({ docType, status, plant, customer })`, `approveSdDoc`, `rejectSdDoc(reason)`.
- Edit: `src/routes/_authenticated.tsx` — replace `/inbox/sd` link with an expandable "SD Approvals" group containing the 4 children; auto-expand when pathname starts with `/sd/`.

## Design
Reuses existing tokens (`bg-card`, `Card`, `Badge`, `Tabs`, `Table`). SAP-like density: compact rows, monospace for doc numbers, right-aligned amounts in `tabular-nums`, ₹ formatting consistent with the inbox. Sticky table header, horizontal scroll with shadow edges. Pending tab gets a bottom action bar when ≥1 row selected.

## Out of scope
- No schema migration; no changes to MM screens, admin, or SAP API settings.
- Real SAP push is mocked by reading from `approval_documents` already synced.
