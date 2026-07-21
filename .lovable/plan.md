## Changes

**SD Approval screens** (Contract, Sales Order, Price, SC-SO, and any shared SD approval shell):
- Reorder action buttons so **Reject** appears first, followed by **Accept**.
- Style the **Accept** button with green (e.g. `bg-green-600 hover:bg-green-700 text-white`) instead of the current default/primary color.

**PR Release screen** (`src/routes/_authenticated/mm.pr-release.tsx`):
- Style the **Release** button with the same green as above. Reject button stays as-is.

## Technical notes

- Investigate `src/components/sd/sd-approval-shell.tsx` first — it likely renders the shared Accept/Reject action bar for all four SD screens, so a single edit there covers them all. If any SD screen renders its own action buttons, update those inline too.
- Use a Tailwind green utility class combo consistent with the app's design tokens; no changes to `src/styles.css` semantic tokens are needed for this one-off action-button accent.
- No business logic, no handler wiring, no payload changes — presentation only.