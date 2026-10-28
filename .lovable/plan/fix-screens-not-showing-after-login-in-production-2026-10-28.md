# Fix: screens not showing after login in Production

## What changes for users
After SAP login, each user sees exactly the screens their SAP roles allow — BMW, MM and IWM screens open individually, not only through one shared "inbox" permission.

## Steps
1. **Sidebar uses each screen's own permission.** Every BMW item checks its own key (`sd.dashboard`, `sd.price`, `sd.contract`, `sd.sc_so`, `sd.sales_order`, `sd.bmw_status`); every MM item its own (`mm.pr_release`, `mm.po_release`, …). The old module inbox key (`APPROVALS.INBOX_SD` / `INBOX_MM`) still grants all screens of that module, so current roles keep working.
2. **Same check on the pages themselves**, so opening a screen URL directly follows the same rule as the sidebar.
3. **Flexible matching of SAP activity codes**: ignore case, spaces, `-`/`_` differences (e.g. `SD.SALES ORDER`, `sd-sales_order`), and accept known BMW aliases (`BMW.PRICE_APPROVAL`, `BMW.STATUS_REPORT`, etc.).
4. **Role-name fallback** when SAP sends roles but no matching activities: role names containing `PRICE`, `CONTRACT`, `SO`/`SALES`, `SERVICE`/`SC`, `STATUS`, `DASHBOARD` grant the matching BMW screen; `BMW_ALL` / `BMW ALL` grants all BMW screens; `ADMIN` grants admin screens.
5. Add small tests for the activity mapping and role-name fallback (e.g. `BMW- PRICE APPROVALS` → Price Approvals only).

## Technical details
- `src/routes/_authenticated.tsx`: per-screen keys in `sdChildren`/`mmChildren`; visibility = `can(key) || can(moduleInboxKey)`.
- `src/lib/admin/screen-keys.ts`: normalize activity codes, alias map, `roleNameToScreenKeys()`.
- `src/hooks/use-permissions.ts`: union of activity-derived keys and role-name fallback keys for the active role.
- Route guards on `/sd/*` and `/mm/*` pages use the same helper.
- After deploy, rebuild the Production frontend; no database changes.
