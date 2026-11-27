# Vehicle Master Approvals – align Approve/Reject payloads with ZV14 document

## What I checked
- SAP API Settings: `VM_APPROVALS-Approve_API` and `VM_APPROVALS-Reject_API` (both PUT, same URL as the document) already list exactly the document's 11 fields in the same order: MANDT, WERKS, VEHICLENO, VEHICLECAP, NETWT, VEH_CAP, VEH_TYPE, TRANSPORT_NAME, UPDATED_BY, APPROV_BY, STATUS, under `approve.` and `reject.`.
- Screen code already sends the same 11 fields with keys `approve` and `reject` (lowercase), one row per request, APPROV_BY = logged-in SAP user.

## The only difference found
- Document's **Approve** sample sends VEHICLECAP and NETWT as text with 3 decimals (`"23.890"`, `"22.000"`). The screen currently sends them as numbers (23.89, 22).
- Document's **Reject** sample sends them as numbers (`23.890`, `22.000`) — the screen already does this.

## Change
1. Approve: send VEHICLECAP and NETWT exactly as returned by the Get API (text, e.g. "23.890"), no number conversion.
2. Reject: unchanged (numbers).
3. SAP API Settings: no field change needed; sync scripts stay as they are.

Nothing else on the screen changes.
