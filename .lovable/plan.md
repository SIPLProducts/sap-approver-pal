## Goal

In the SD Approvals screens (BMW Status Report, Price/Contract/Sales Order/SC-SO), the Plant and Customer dropdowns currently size to the space inside the Selection Screen card, so opening them makes the card feel cramped and never covers the results table underneath. The reference screenshot shows a full-height dropdown that floats over the table.

## Change

Make the Radix Popover content in the three SAP F4 pickers render taller and always overlay downward, so the option list floats over the table below instead of squeezing inside the Selection Screen row.

Files to edit:

1. `src/components/sap/plant-select.tsx` — `<PopoverContent>` (currently `className="z-[1000] w-[320px] p-0"`).
2. `src/components/sap/customer-select.tsx` — `<PopoverContent>` (currently `className="z-[1000] w-[380px] p-0"`).
3. `src/components/sap/plant-multi-select.tsx` — `<PopoverContent>` (currently `className="w-[320px] p-0 max-h-[340px] overflow-hidden"`).

For each, update the `<PopoverContent>` to:

- Add `side="bottom"`, `align="start"`, `sideOffset={6}`, `avoidCollisions={false}` so the panel always opens downward over the table instead of flipping up or resizing to fit the card.
- Keep `z-[1000]` (multi-select gains it) so it sits above the Cloudscape sticky header.
- Give it a taller floating panel: `max-h-[60vh]` on `PopoverContent` and `max-h-[calc(60vh-3rem)]` on the inner `<CommandList>` (subtracting the search input row) so the list scrolls internally instead of pushing layout.

No other component, route, or styling changes. Behavior for keyboard nav, selection, and search stays identical.

## Technical notes

- `PopoverContent` already portals to `document.body`, so raising `max-h` and disabling collision-flip is enough to make it overlay the Cloudscape table without affecting the Selection Screen card height.
- `CommandList` in shadcn defaults to `max-h-[300px]`; overriding via `className` on the rendered `CommandList` is required, otherwise the outer `max-h` on `PopoverContent` has no visible effect.
- No changes to `src/components/ui/popover.tsx` — the fix is scoped to the three SAP pickers so other popovers in the app are untouched.