# Clarification "Send Mail" calls ZNFA_Clarification_API

On the Release path, opening an NFA document and clicking **Clarification** already shows a popup with a text box. This step wires **Send Mail** to a live SAP call.

## Behaviour

- Send Mail is disabled while the text box is empty; on click it shows a pending state ("Sending…").
- Payload sent to the `ZNFA_Clarification_API` config:

```text
{ "ZNFA_NUM": "<opened NFA number>", "USER": "<SAP user id>", "REL_CODE": "<selected Release Code>",
  "NFA_REL": "", "REJECT": "", "REJ_DEL_REASON": "", "DELETE": "",
  "CLARIFY": "X", "DIS_CLARIFY": "",
  "TEXT_CLARIFY": [ { "LINE": "<each line of the entered text>" } ] }
```

- Success (`STATUS` not FALSE) → success toast with the SAP `MSG` (e.g. "Mail Sent Sucessfully"), dialog closes and the text box clears.
- `STATUS: "FALSE"` → the exact SAP `MSG` is shown as a red error line inside the popup; the dialog stays open so the text isn't lost.
- Network / HTTP / invalid-JSON failures use the same wording as the existing Approve and Reject calls.
- Display Clarification button stays as-is for now.

## Technical notes

- Extend `src/lib/mm/znfa-approve.functions.ts`: add `mode: "approve" | "reject" | "clarify"` (keeping the current `reject` flag behaviour) with config name `ZNFA_Clarification_API`, and build the extra `CLARIFY` / `DIS_CLARIFY` / `TEXT_CLARIFY` fields. Same proxy/direct + `raw: true` + `extractSapMsg` + `sap_api_sync_log` pattern; log tag `znfa-clarify`.
- `TEXT_CLARIFY` is built by splitting the entered text on newlines, dropping empty lines, one `{ LINE }` per row.
- `src/routes/_authenticated/mm.znfa-release.tsx`: add a `clarifyMutation` (`useMutation` on the server fn via `useServerFn`) plus `clarifyError` state; Send Mail triggers it using `openedNfaNo`, the SAP user id from `useSapProfile`, and the already-selected Release Code.
- No schema, RLS, or API-settings changes.
