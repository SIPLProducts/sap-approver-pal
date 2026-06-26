## Problem
Both the Plant F4 dropdown (`plant-multi-select.tsx`) and the Role F4 dropdown (`admin.users.tsx` — `RoleMultiSelect`) currently indicate selection with a `Check` icon from `lucide-react`. The user wants an actual checkbox control shown next to each item.

## Changes

### `src/components/sap/plant-multi-select.tsx`
- Import `Checkbox` from `@/components/ui/checkbox`.
- In the dropdown list (including the "Select all / Clear all" item and each plant item), replace the `<Check>` icon with a `<Checkbox checked={…} readOnly tabIndex={-1} className="pointer-events-none mr-2" />` so the visual becomes a real checkbox while `CommandItem` still owns the click/keyboard interaction.

### `src/routes/_authenticated/admin.users.tsx` — `RoleMultiSelect`
- Import `Checkbox` from `@/components/ui/checkbox`.
- Same replacement inside `RoleMultiSelect`: "Select all / Clear all" item and each role item get a `Checkbox` instead of the `Check` icon.

## Out of scope
- No changes to selection logic, validation, submit flow, or backend.
- No layout or sizing changes beyond the checkbox swap.