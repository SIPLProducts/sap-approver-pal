# ZMC Report Date Picker Redesign

## Goal

Redesign the From Date and To Date pickers on the ZMC Report screen so they look clean, modern, and professional, matching the established executive calendar style used elsewhere in the app. All existing functionality, APIs, filters, and business logic remain unchanged.

## What changes

- Update the `DateField` component in `src/routes/_authenticated/mm.zmc-report.tsx` only.
- Replace the default calendar popover styling with the refined single-month calendar style already approved for the SD Dashboard date picker:
  - Centered "Month Year" caption with simple rounded previous/next navigation buttons.
  - Weekday row as `Su Mo Tu We Th Fr Sa` with consistent spacing and alignment.
  - Muted, unselectable out-of-month days.
  - Rounded (not range-style) highlight for the selected day using the primary semantic token.
  - Subtle border treatment for today's date instead of the default accent fill.
  - Slightly more generous internal padding for readability.
- Keep the existing two-trigger From/To layout inside the Date filter row, preserving equal widths and the responsive `From / To` separator.
- Preserve the existing date display format (`dd-MM-yyyy`), `placeholder`, `value`, `onChange`, and `executed` / reset behavior.

## Technical notes

- File touched: `src/routes/_authenticated/mm.zmc-report.tsx` only.
- The `Calendar` component inside `DateField` receives a custom `classNames` object (same pattern as the SD Dashboard date picker) using the project's semantic tokens (`--primary`, `--primary-foreground`, `--muted-foreground`, `--border`, etc.) through Tailwind utilities. No hardcoded colors.
- `pointer-events-auto` remains on the calendar so it stays interactive inside the popover.
- No changes to SAP payloads, route configuration, sidebar, permissions, or report results table.

## Verification

- Run the project type check.
- Open the ZMC Report screen and interact with both date pickers at desktop and mobile widths, confirming the calendar opens, dates select, and the selected value displays correctly.
- Confirm Reset and Execute still behave as today.