# ZNFA Approve (Release) + Clarification popup

## 1. Approve calls ZNFA_APPROVE_API

On the Release path, after clicking an NFA No and opening the document, the toolbar **Approve** button will send a live SAP call to the `ZNFA_APPROVE_API` config instead of showing the placeholder toast.

Payload:

```text
{ "ZNFA_NUM": "<opened NFA number>", "USER": "<SAP user id>", "REL_CODE": "<selected Release Code>",
  "NFA_REL": "X", "REJECT": "", "REJ_DEL_REASON": "", "DELETE": "" }
```

Behaviour:
- Confirmation dialog stays as today; on confirm the button shows a pending state.
- `STATUS: "FALSE"` → show the exact SAP `MSG` (e.g. "Already Released..!") as a red error alert plus a toast; nothing else changes.
- Success (`STATUS` not FALSE) → success toast with the SAP `MSG`/`NUMBER`, return to the results list and refresh the release list so the released row reflects its new state.
- Network/HTTP/JSON failure → same message style already used by the other ZNFA calls.
- Reject / Clarification / Display Clarification button wiring is unchanged in this step.

## 2. Clarification popup

Clicking **Clarification** in the document toolbar opens a modal dialog:
- Title "Clarification" with the NFA number.
- One multi-line input box (sized textarea) for the clarification text.
- **Send Mail** button (disabled while the box is empty) and **Cancel** button.
- Cancel closes and clears the text. Send Mail closes the dialog and confirms with a toast; the actual mail/SAP call is wired once that API is configured.

## Technical notes

- New `src/lib/mm/znfa-approve.functions.ts`: `approveZnfa` server function (`requireSupabaseAuth`), config name `ZNFA_APPROVE_API`, same proxy/direct + `raw: true` + `extractSapMsg` + `sap_api_sync_log` pattern as `znfa-release.functions.ts`. Returns `{ ok, sapMessage, number, error }`.
- `src/routes/_authenticated/mm.znfa-release.tsx`: `useMutation` on `approveZnfa` in `onDocApprove` using `openedNfaNo`, the SAP user id from `useSapProfile`, and the Release Code already captured in the release step; error surfaced in the existing document error alert. Add local state + `Dialog` for the Clarification popup.
- No schema, RLS, or API-settings changes.
