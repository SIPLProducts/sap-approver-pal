# AVG_RATE in Approve/Reject payloads — already in place

Both Approve (AVG_Approvals_Approve_API) and Reject (AVG_Approvals_Reject_API) on Average Selling Rate Approvals already send `AVG_RATE` taken from each selected row's Average Selling Rate value. No FIN_RATE and no fixed value is used.

## Plan
- No code changes needed.
- Optional check: run Execute with Pending, tick a row, click Approve/Reject, and confirm SAP receives that row's rate.

## Technical details
`src/routes/_authenticated/imw.average-selling-rate-approvals.tsx` builds `AVG_RATE` from `row.AVG_RATE` (commas stripped, sent as a number) in both the approve and reject payloads.
