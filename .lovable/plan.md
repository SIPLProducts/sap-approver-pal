# Distance Master: New Record checkbox

Add a "New Record" checkbox right after the Plant field in the Distance Master input card, styled exactly like the one on Average Selling Rate / Financial Year Base Rate.

- Unticked by default; Reset unticks it.
- Execute and everything else on the screen stay unchanged (the checkbox is not sent to SAP until you give the API details).

## Technical details
- `src/routes/_authenticated/imw.distance-master.tsx`: add `newRecord` state, import `Checkbox`, copy the checkbox markup from `imw.average-selling-rate.tsx`, change grid to `lg:grid-cols-[220px_auto_1fr]`, clear in Reset.
