# IMW Approvals module with Price Master Update screen

Add a third workspace module alongside MM Approvals and BMW Approvals, containing one screen: Price Master Update. UI only for now — Execute validates input and shows an empty results area until the SAP API is provided.

## Sidebar

- New collapsible "IMW Approvals" group in the sidebar, styled exactly like the existing BMW/MM groups (icon, active bar, chevron, child list).
- One child: Price Master Update at `/imw/price-master`.
- The group only appears when the user's role has the new IMW permission.

## Permissions

- New "IMW Approvals" module in the screen catalog with entries: IMW Approvals Inbox and Price Master Update, so admins can assign them in Custom Roles / Role Permissions.
- The sidebar group and the route gate on the IMW Approvals Inbox permission.

## Price Master Update screen

Follows the reference layout, rendered in the current app design (PageHeader + compact selection Card):

- Eyebrow "IMW Approvals", title "Price Master Update".
- One compact selection card, single aligned row/grid:
  - Plant (required) — existing plant multi-select restricted to assigned plants, same as BMW screens.
  - Customer — single field using the existing customer F4 select (no From/To).
  - Mode — Display / Update radio group, same styling as Contract Approvals, default Display.
  - Execute button inside the card, plus Reset.
- Below the card: the standard results table shell showing "Enter Plant and click Execute…" empty state, ready to receive rows once the API is wired.

## What stays the same

No changes to existing screens, SAP functions, payloads, routes, or access logic for MM/BMW.

## Technical notes

- `src/lib/admin/screen-keys.ts`: add a `SCREEN_GROUPS` entry `{ module: "IMW Approvals", screens: [ { key: "approvals.inbox.imw", activity: "APPROVALS.INBOX_IMW" }, { key: "imw.price_master", activity: "IMW.PRICE_MASTER" } ] }`. All maps derive from this array.
- New route `src/routes/_authenticated/imw.price-master.tsx` with `createFileRoute("/_authenticated/imw/price-master")`, reusing `PageHeader`, `Card`, `PlantMultiSelect`, `CustomerSelect`, `RadioGroup`, and `CloudscapeApprovalTable` (empty rows).
- `src/routes/_authenticated.tsx`: add `imwChildren` + `imwOpen/imwExpanded` state and a third group block mirroring the BMW block; no changes to existing blocks.
