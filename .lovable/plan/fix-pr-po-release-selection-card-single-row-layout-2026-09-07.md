# Fix PR/PO Release selection-card single-row layout

## Problem
On the **PR Release** and **PO Release** screens, the selection card currently uses a fixed-width 4-column grid (`xl:grid-cols-[minmax(220px,1.2fr)_minmax(360px,1.6fr)_auto_auto]`). At normal page sizes this makes the Release Group/Code block too wide, pushes the **Reset** button outside the card, and distorts the row alignment.

## Goal
Display **Plant**, **Release Group/Code**, **Cancel Record** checkbox, **Execute**, and **Reset** in a single, evenly-spaced row inside the selection card, while keeping the existing behavior untouched.

## Scope
Only the selection-card layout in these two route files changes. No APIs, state, handlers, validations, table logic, or other UI behavior will be modified.

## Plan
1. **PO Release** (`src/routes/_authenticated/mm.po-release.tsx`)
   - Replace the inner selection grid with a responsive single-row layout.
   - Use a container that lets fields share the row naturally (flex or a loose grid) with consistent gaps.
   - Keep `items-end` alignment so all controls line up at the bottom.
   - Ensure the checkbox and buttons stay grouped and do not wrap before the fields do.
   - Maintain the existing mobile fallback (wrap to multiple lines on very small viewports).

2. **PR Release** (`src/routes/_authenticated/mm.pr-release.tsx`)
   - Apply the same layout change as PO Release.
   - Preserve the existing `ReleaseKeySelect` usage and `Cancel Record` checkbox.

## Expected result
At typical desktop widths the selection card shows all controls in one clean row with proper spacing, and the **Reset** button remains inside the card. Functionality, filters, pagination, and row actions remain identical.
