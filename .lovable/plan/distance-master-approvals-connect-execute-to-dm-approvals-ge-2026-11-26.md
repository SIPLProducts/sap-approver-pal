# Distance Master Approvals — connect Execute to DM_APPROVALS_GET_API

## What changes
- **Execute** calls `DM_APPROVALS_GET_API` (from SAP API Settings) with:
  `{ get_data: { user_name, plant: [{ plant }], R_pen, R_APPR, R_REJ } }`
  - `user_name` = logged-in user's SAP ID; `plant` = every selected plant.
  - Selected status gets `"X"`, the others `" "` (same as other approval screens).
- Results appear in a table below the selection card with columns: Plant (WERKS), Customer (KUNNR), Distance (DISTANCE, numbers like `89.0` shown correctly), Updated Person (UPDATED_BY), Approver (APPROV_BY), Status (STATUS).
- `MANDT` and all other returned fields stay in each row (not shown) for the later Approve/Reject step.
- **Pending** results: a checkbox on each row plus **Approve** and **Reject** buttons at the table's top-right, same look and row selection as Financial Year Base Rate Approvals. Until you send their API details, those buttons show "SAP API not configured yet".
- **Completed / Rejected**: table only, no checkboxes or buttons.
- SAP errors show in the usual SAP message popup; Reset also clears the table.

## Technical details
- Add `getDmApprovalsGetConfig` in `src/lib/sap/customer.functions.ts` (copy of `getAvgApprovalsGetConfig`, name `DM_APPROVALS_GET_API`).
- In `imw.distance-master-approvals.tsx`, copy the fetch mutation, `extractRows`, row-key selection, `CloudscapeApprovalTable` usage and `headerExtras` from `imw.average-selling-rate-approvals.tsx`; track the status used at execution so actions only appear for Pending results.
- No other screens touched.
