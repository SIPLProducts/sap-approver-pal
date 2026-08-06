# ZNFA Reject — reason popup + ZNFA_REJECT_API

## Behaviour

On the Release path, after opening an NFA number, clicking **Reject** in the document toolbar opens a popup instead of the current confirm/placeholder toast:

- Title "Reject NFA <number>".
- One multi-line **Reject Reason** textarea.
- **Reject** button (disabled while the reason is empty, shows a pending state while calling SAP) and **Cancel** (closes and clears the text).

On Reject, the app calls the `ZNFA_REJECT_API` config from SAP API Settings with:

```text
{ "ZNFA_NUM": "<opened NFA number>", "USER": "<SAP user id>", "REL_CODE": "<selected Release Code>",
  "NFA_REL": "", "REJECT": "X", "REJ_DEL_REASON": "<entered reason>", "DELETE": "" }
```

Outcomes:
- `STATUS: "TRUE"` → success toast with the SAP `MSG` (e.g. "Rejected Successfully"), close the popup, return to the results list and refresh the release list so the row reflects its new state.
- `STATUS: "FALSE"` → keep the popup open and show the exact SAP `MSG` as a red error inside it, plus a toast.
- Network/HTTP/JSON failure → same message style already used by Approve.

Approve, Clarification, Preview, Back, and the Display / Approved List paths are unchanged.

## Technical notes

- `src/lib/mm/znfa-approve.functions.ts` already builds the reject payload shape but always posts to `ZNFA_APPROVE_API`. Change the config lookup to pick `ZNFA_REJECT_API` when `reject` is true and `ZNFA_APPROVE_API` otherwise; keep the same proxy/direct + `raw: true` + `extractSapMsg` + `sap_api_sync_log` flow and the existing `znfa-reject` log tag. If the reject config is missing/disabled, surface that config name in the error.
- `src/routes/_authenticated/mm.znfa-release.tsx`: replace `onDocReject`'s confirm + placeholder toast with `setRejectOpen(true)`; add `rejectOpen` / `rejectReason` / `rejectError` state and a `Dialog` mirroring the existing Clarification popup; add a `rejectMutation` on `approveZnfa` with `reject: true` and the reason, reusing the Approve success path (list refresh + back to results).
- No schema, RLS, or API-settings changes.
