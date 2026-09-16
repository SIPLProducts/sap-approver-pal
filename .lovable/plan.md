# ZMC and ZGP Report Date Field Alignment

## Goal

Make the Date From and Date To fields in both report screens match the existing Service Entry Sheet “Created on” date field, while preserving all report behavior and SAP integration.

## Changes

1. In **ZMC Report** and **ZGP Report**, replace the custom calendar popover fields with the same native date input pattern used by the Service Entry Sheet:
   - Standard date input control.
   - Matching compact height, text sizing, and field appearance.
   - Existing From/To field alignment and responsive layout remain unchanged.
2. Keep the selected dates connected to the existing report filters and continue sending `date_from` and `date_to` in the current `yyyy-MM-dd` API format.
3. Remove the **“From / To”** text from the top-right of each report’s filter card header.
4. Leave the inline separator between the two inputs, all other filters, Reset/Execute, result tables, Cancel actions, SAP payloads, and permissions unchanged.

## Files

- `src/routes/_authenticated/mm.zmc-report.tsx`
- `src/routes/_authenticated/mm.zgp-report.tsx`

## Verification

- Confirm both Date From and Date To fields visually match the Service Entry Sheet date field.
- Select dates, run each report, and confirm the existing API date values are unchanged.
- Confirm Reset clears both dates.
- Confirm the card-header “From / To” text is absent on both screens without affecting layout.
- Run the project type check.
