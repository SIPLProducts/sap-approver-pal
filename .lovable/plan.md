# Price Master Update button state + new Price Master Update Approvals screen

## 1. Update button (Price Master Update)

- The Update button above the results table stays disabled until at least one row checkbox is selected.
- It enables as soon as one or more records are selected.
- It is styled green (success look) instead of the default primary red, using a token-based green class in the button.
- Everything else on the screen (selection card, credential popup, fetch, editable fields) is unchanged.

## 2. New screen: Price Master Update Approvals

A second screen in the IMW Approvals module, placed directly after Price Master Update in the sidebar, at `/imw/price-master-approvals`.

Selection card (same compact design as the existing screens):

- Plant (required) — existing plant multi-select restricted to assigned plants
- Customer — existing customer F4 select
- Date From and Date To — existing date picker style used elsewhere in the app
- Status radio group: Pending / Approved / Rejected, laid out exactly like Contract Approvals (separate row under the filters, divider above, `Status *` label, horizontal radios)
- Execute and Reset buttons inside the card

Below the card: the standard results table shell with an empty state message. No SAP API is wired yet for this screen — the fetch call is added once the approvals API name and payload are provided.

Permissions: a new entry "Price Master Update Approvals" appears under the IMW Approvals module in Custom Roles / Role Permissions, and the sidebar item and route gate on it.

## What stays the same

No changes to existing screens, SAP functions, payloads, routes, or access logic for MM/BMW/IMW Price Master Update beyond the Update button state and colour.

## Technical notes

- `src/routes/_authenticated/imw.price-master.tsx`: `headerExtras` Update button gets `disabled={selected.size === 0}` and green classes (`bg-emerald-600 hover:bg-emerald-700 text-white`), no logic change.
- `src/lib/admin/screen-keys.ts`: add `{ key: "imw.price_master_approvals", label: "Price Master Update Approvals", activity: "IMW.PRICE_MASTER_APPROVALS" }` to the IMW group.
- `src/routes/_authenticated.tsx`: add the child entry to `imwChildren` after the existing one.
- New `src/routes/_authenticated/imw.price-master-approvals.tsx` using `createFileRoute("/_authenticated/imw/price-master-approvals")`, its own `head()` meta, and reusing `PageHeader`, `Card`, `PlantMultiSelect`, `CustomerSelect`, shadcn `Popover` + `Calendar` date pickers, `RadioGroup`, and `CloudscapeApprovalTable` with empty rows.
