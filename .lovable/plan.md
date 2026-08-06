# Display Clarification — ZNFA_DISPLAY_CLARIFY_API

## What happens

On the Release path, after opening an NFA document, clicking **Display Clarification** in the toolbar calls the `ZNFA_DISPLAY_CLARIFY_API` config in SAP API Settings with:

```text
{ "ZNFA_NUM": "<opened NFA no>", "USER": "<SAP user id>", "REL_CODE": "<release code>",
  "NFA_REL": "", "REJECT": "", "REJ_DEL_REASON": "", "DELETE": "",
  "CLARIFY": "", "DIS_CLARIFY": "X", "TEXT_CLARIFY": [] }
```

SAP returns an array of `{ "LINE": "..." }` entries.

## Popup

- Opens a dialog titled "Display Clarification — <NFA No>".
- A read-only multi-line text area (same size/style as the Clarification popup) showing every `LINE` value joined in order, one per line (blank lines and dashed separators preserved exactly as returned).
- Only a **Cancel** button (closes the popup).
- While the call runs the button shows a loading state and the box shows "Loading…".
- If SAP returns `STATUS: "FALSE"` or a `MSG`, or the call fails, the exact SAP message is shown in the popup as an error line (same red style already used) plus a toast.
- If SAP returns no lines, the box shows "No clarification found for this NFA."

Everything else — Approve, Reject, Clarification (Send Mail), Preview, Back — stays exactly as it is.

## Technical notes

- `src/lib/mm/znfa-approve.functions.ts`: add config name `ZNFA_DISPLAY_CLARIFY_API` and a `disClarify` boolean input. When set, payload uses `CLARIFY: ""`, `DIS_CLARIFY: "X"`, `TEXT_CLARIFY: []`; response parsing also accepts a top-level array of `{ LINE }` and returns them as a new `lines: string[]` field on `ZnfaApproveResponse` (defaults to `[]` for the existing approve/reject/clarify paths, so nothing else changes). Log tag `znfa-dis-clarify`; same proxy/direct + `raw: true` + `sap_api_sync_log` pattern.
- `src/routes/_authenticated/mm.znfa-release.tsx`: add `disClarifyOpen`, `disClarifyLines`, `disClarifyError` state and a `disClarifyMutation` on the same server function; wire the existing Display Clarification toolbar button (currently a placeholder toast) to open the dialog and fire the call; add the read-only `Textarea` dialog with a single Cancel button.
- No schema, RLS, or API-settings changes.
