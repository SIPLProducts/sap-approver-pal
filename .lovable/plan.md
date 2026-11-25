# Financial Year Base Rate: read-only Customer, Customer Name, Material outside New Record

## Change
After Execute with **New Record unticked**, the Customer, Customer Name and Material columns show their values as plain text, so they can't be changed. With New Record ticked, they stay as dropdowns you can pick from, as they work now.

Financial Base Rate stays editable in both modes. Change, Delete and Save send the same data as today.

## Technical details
- In `src/routes/_authenticated/imw.financial-year-base-rate.tsx`, the KUNNR / NAME1 / MATERIAL cells render `CustomerSelect` only when `executedCheck === "X"`, otherwise `show(row[id])`. The existing memo already depends on `executedCheck`.
