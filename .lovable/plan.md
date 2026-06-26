## Goals

1. Plant dropdown trigger shows selected plant IDs (comma-separated, truncated) instead of "X selected".
2. Both Plant and Role F4 popovers expose a **Select All / Clear All** toggle at the top of the list.
3. Both popovers scroll correctly when the list overflows.

## Changes

### `src/components/sap/plant-multi-select.tsx`
- Trigger label: when `value.length > 0`, render `value.join(", ")` inside a `truncate` span instead of `"{n} selected"`. Keep mono font and the chevron.
- Inside `CommandList`, above the plants `CommandGroup`, add a sticky header row `CommandItem` "Select all (N)" / "Clear all (N)" that toggles between `onChange(plants)` and `onChange([])` based on whether every plant is currently selected.
- Widen `PopoverContent` to `w-[280px]` and set `max-h-[320px]`; add `overflow-hidden` so the inner `CommandList` (already `max-h-[300px] overflow-y-auto`) owns the scrollbar. Add `onWheel={(e) => e.stopPropagation()}` on `PopoverContent` so wheel events don't bubble to the parent `Dialog` and get swallowed.

### `src/routes/_authenticated/admin.users.tsx` — `RoleMultiSelect` (around line 905)
- Add the same "Select all / Clear all" `CommandItem` above the roles `CommandGroup`, toggling between `onChange(ALL_ROLES)` and `onChange([])`.
- Add `max-h-[320px] overflow-hidden` and `onWheel={(e) => e.stopPropagation()}` to its `PopoverContent` for the in-dialog scroll fix.
- Leave the existing trigger label logic (already shows role names up to 2, then count) unchanged unless feedback says otherwise.

### Out of scope
- No backend / validation / submit-flow changes.
- No edits to `src/components/ui/command.tsx` or `popover.tsx`.
