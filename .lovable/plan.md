Add four action buttons (Rating, Change, Display, Attachments) below the ZNFA Rating result table. When the user selects rows via checkboxes and clicks any button, call the configured `ZNFA_Create_API` with the required payload. After a successful response, render a new card showing `OUTPUT.PR_NUMBER`, `OUTPUT.PR_DATE`, and `OUTPUT.TER_SUB_ID` as read-only fields plus two tables for `OUTPUT.ITEMS` and `OUTPUT.RATINGS`.

## Scope
- Only `src/routes/_authenticated/mm.gate-process.tsx` and `src/lib/mm/gate-process.functions.ts` will change.
- Existing fetch/execute behavior for `ZNFA_Fetch_API` remains unchanged.

## Backend: new server function
Create `createZnfa` in `src/lib/mm/gate-process.functions.ts`:
- Method: `POST`, authenticated via `requireSupabaseAuth`.
- Reads the `ZNFA_Create_API` row from `sap_api_configs` and supporting credentials/settings.
- Accepts input `{ action: "RATE" | "CHANGE" | "DISPLAY" | "ATTACHMENTS"; user_id: string; data: Array<{ CHECK: string; BANFN: string; ANFNR: string; TITLE: string; NAME1: string; TER_SUB_ID: string }> }`.
- Builds the SAP payload: the chosen action flag is `"X"`, the other three flags are `""`, plus `USER_ID` and `DATA`.
- Calls SAP via the configured proxy/direct mode, with the same error-logging and latency tracking used in `fetchGateProcess`.
- Returns the raw SAP response as a plain DTO: `{ output?: { PR_NUMBER, PR_DATE, TER_SUB_ID, ITEMS[], RATINGS[] }, error?: string | null }`.

## Frontend: ZNFA Rating screen
Update `src/routes/_authenticated/mm.gate-process.tsx`:
1. Add a `useServerFn` hook for `createZnfa` and a `useMutation` to call it.
2. Track `output` state for the response card.
3. After the existing `CloudscapeApprovalTable`, render a button row:
   - Buttons: Rating, Change, Display, Attachments.
   - All disabled when no rows are selected or when the mutation is pending.
   - Each button's `onClick` builds the payload from the selected rows using the mapping `PR_NUMBER`→`BANFN`, `RFQ_NUMBER`→`ANFNR`, `RFQ_TITLE`→`TITLE`, `VENDOR_NAME`→`NAME1`, `TER_SUB_ID`→`TER_SUB_ID`, and `CHECK`="X".
   - Show a toast on success/error; store the returned `OUTPUT` in state.
4. Render the response card only when `output` exists:
   - Read-only inputs for `PR_NUMBER`, `PR_DATE`, `TER_SUB_ID`.
   - Table for `ITEMS` (columns: SR_NO, MATERIAL, DESCRIPTION, TENDER_SPEC, UOM, VENDOR_NAME, REMARKS).
   - Table for `RATINGS` (columns: VENDOR, RATE).
5. Reset `output` when the user clicks Reset or Execute again.

## Data mapping
- Payload keys: `BANFN`, `ANFNR`, `TITLE`, `NAME1`, `TER_SUB_ID`, `CHECK`.
- Source row keys: `pr_number`, `rfq_number`, `rfq_title`, `vendor_name`, `ter_sub_id`.
- Action flags: `RATE`, `CHANGE`, `DISPLAY`, `ATTACHMENTS` — exactly one is `"X"` based on the clicked button.

## Validation
- Build passes and existing ZNFA Rating fetch still works.
- Buttons are disabled until at least one row is selected.
- Response card renders the sample `OUTPUT` shape correctly.