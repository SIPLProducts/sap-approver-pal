# Match Transportation Approvals Status Layout

Update only the Status presentation on **Transportation (90%) Exception Billing Approvals** to match the Status section in **Price Master Update Approvals**.

## Change
- Move the existing Status label and radio group into the same separate, full-width row below the Plant/Execute controls.
- Apply the same separator and spacing classes: `mt-4 -mx-4 border-t px-4 pt-3`, with the inner `flex flex-wrap items-center gap-6` layout and matching label/radio styles.
- Preserve the current Pending, Completed, and Rejected values, default, selection behavior, and all other screen behavior. Do not modify the Price Master screen.
