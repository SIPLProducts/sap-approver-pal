# Move Save / add Change and Delete to the top-right of the Transportation results table

## What changes

On the Transportation (90%) Exception Billing screen, once results are fetched, the action buttons move to the top-right corner of the results table header, in this order: **Save**, **Change**, **Delete**.

```text
before
Transportation (90%) Exception Billing   (3)
[Save] [Search........]

after
Transportation (90%) Exception Billing   (3)
[Search........]              [Save] [Change] [Delete]
```

Colours, using the app's existing button styles:

| Button | Style | Look |
| --- | --- | --- |
| Save | existing/default (primary) | unchanged — same brand red as today |
| Change | `success` variant | green (#1F8A5F), white label |
| Delete | `destructive` variant | red (#C23B32), white label |

All three use the same small size already used by the table's toolbar buttons, so they line up with the search box.

## Behaviour

- Save keeps exactly what it does today (it is a display-only button — no SAP write-back API has been given for this screen).
- Change and Delete are added as visible actions with no action wired, for the same reason: no save/change/delete API name or payload has been supplied for this screen. They are styled and placed as requested so the wiring can be added later in one place.
- Nothing else on the screen changes: Plant F4 search, Execute payload, the eight result columns, the row checkboxes, the Check Value checkbox, editable Remarks, and the Customer / Customer Name F4 selectors all stay as they are.

## Technical details

- `src/routes/_authenticated/imw.transportation-exception-billing.tsx`
  - Remove the current `headerLeading={<Button size="sm">Save</Button>}`.
  - Add `headerExtras={...}` with three buttons: `<Button size="sm">Save</Button>`, `<Button size="sm" variant="success">Change</Button>`, `<Button size="sm" variant="destructive">Delete</Button>`.
- `headerExtras` is the shared top-right slot of `CloudscapeApprovalTable` (already used by the ZGP/ZMC report Cancel buttons), so no shared-component change is needed and no other screen is affected.
- Verify with `bunx tsgo --noEmit -p tsconfig.json` and the preview build log, then confirm visually in the preview after Execute.
