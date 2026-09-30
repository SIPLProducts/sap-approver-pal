# Transportation (90%) Exception Billing screen (IWM Approvals)

Add a new screen "Transportation (90%) Exception Billing" to the IWM Approvals sidebar group, directly after Price Master Update Approvals. Presentation-only for now — no SAP API is wired until service details are shared.

## Sidebar

- New child entry "Transportation (90%) Exception Billing" in the existing IWM Approvals group, placed after Price Master Update Approvals, using the same icon/active-bar styling as the other IMW items.
- Same visibility rule as the other IMW screens (IWM inbox permission or this screen's own permission).

## Permissions

- New screen-catalog entry in `src/lib/admin/screen-keys.ts`: `{ key: "imw.transport_exception_billing", label: "Transportation (90%) Exception Billing", activity: "IMW.TRANSPORT_EXCEPTION_BILLING" }` after `imw.price_master_approvals`, so admins can assign it in Custom Roles.

## Screen layout

New route `/imw/transportation-exception-billing`, following the same design as the other IMW screens (PageHeader + compact selection Card):

- Eyebrow "IWM Approvals", title "Transportation (90%) Exception Billing", short subtitle.
- One compact selection card with a single aligned row:
  - Customer — existing customer F4 select (CustomerSelect), same as the Price Master screens.
  - Customer Name — plain text input.
  - Execute button (primary) and Reset button (clears both fields).
- Below the card: the standard results table shell (CloudscapeApprovalTable) in an empty state saying the exception billing service is not connected yet, revealed after Execute is clicked.
- Own route `head()` metadata (title, description, og:title, og:description).

## What stays the same

No changes to any existing screen, API, payload, validation, filter, pagination, permission, or navigation behavior. No new SAP calls.

## Technical notes

- New route `src/routes/_authenticated/imw.transportation-exception-billing.tsx` with `createFileRoute("/_authenticated/imw/transportation-exception-billing")`, reusing `PageHeader`, `Card`, `Label`, `Input`, `Button`, `CustomerSelect`, and `CloudscapeApprovalTable` (empty rows).
- `src/routes/_authenticated.tsx`: append `{ to: "/imw/transportation-exception-billing", label: "Transportation (90%) Exception Billing", icon: Tag, screen: "imw.transport_exception_billing" }` to `imwChildren` after the approvals entry; no other sidebar changes.
- Filter state is local to the component; Execute validates nothing mandatory (both fields optional) and shows the empty results shell.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Preview pass: new entry appears after Price Master Update Approvals, screen renders with Customer F4 + Customer Name + Execute/Reset, and existing IMW screens are unchanged.
