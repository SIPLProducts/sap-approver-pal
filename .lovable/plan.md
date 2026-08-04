# ZNFA Release — clickable NFA No opens the full NFA document

After the Release (or Approved List) results table loads, each row's **NFA No** becomes a link. Clicking it fetches that NFA document from SAP and renders it with the same cards and layout the Display step already uses.

Confirmed: the SAP API config `ZNFA_Click _API` exists and is active (POST).

## Behaviour

1. In the results table, the NFA No cell renders as a link-styled button (underlined, primary colour); all other cells stay as they are.
2. Clicking it calls `ZNFA_Click _API` with:
   `{ TYPE_NFA: "", ZRFQS: [{ RFQ: "" }], GET: "", REL_CODE: "<selected Release Code>", ZNFA_NUM: "<clicked row's NFA_NO>", PRINT: "" }`
3. While loading, the clicked row shows a busy state and skeleton rows appear below the results table.
4. On success, the detail cards appear below the results table, populated exactly like the Display step: header fields (Type of NFA, NFA Title, Approved/Balance Budget), RFQ Number, Buyer Details, Scope of Work / Purchase Type, PR Details table, RFQ Details table, Final Recommendation table, Attachments List, NFA Texts — same field mapping, same columns, same styling.
5. Additionally, an **APPROVAL / RELEASE MATRIX** table is rendered from `REL_MATX` with columns: NFA No `NFA_NO`, Release Code `REL_CODE`, Approver `APPROVER`, Approver Name `APP_NAME`, Release Group `FRGCT`, Status `STATUS`, Approver Date `APPROVER_DATE`, Sequence `REL_SEQUENCE`. This section also appears for the Display step, since the response shape is identical.
6. Failure (`STATUS: "FALSE"`, HTTP/network/JSON error): no empty tables — a red alert shows the exact SAP `MSG` text plus a toast, matching the current Display error handling.
7. Clicking a different NFA No replaces the previously loaded document. Changing action, plant, or Release Code clears the results and any loaded document.

## Technical notes

- `src/lib/mm/znfa-display.functions.ts`: add `relMatx` to `ZnfaDisplayResponse` (and to the `empty()` shape), populated from `REL_MATX`.
- New `src/lib/mm/znfa-click.functions.ts`: `fetchZnfaClick` server function modelled on `fetchZnfaDisplay` — `requireSupabaseAuth`, zod input `{ znfaNum, relCode }`, config `ZNFA_Click _API`, same proxy/direct handling with `raw: true`, same `extractSapMsg` error paths, same sync-log inserts, returning the same `ZnfaDisplayResponse` shape.
- `src/routes/_authenticated/mm.znfa-release.tsx`:
  - Extract the existing display-result state assignment into one shared `applyZnfaDocument(res)` helper so both `displayMutation` and the new `clickMutation` fill the same state.
  - Add `clickMutation` (`useMutation` + `useServerFn`), `clickedNfaNo` state, and a `REL_MATX_COLUMNS` definition.
  - Render the NFA No cell as a `<button>` with link styling; wire `onClick` to the mutation with the currently selected `releaseCode`.
  - Gate the detail cards on "display confirmed OR a clicked document is loaded", and render the release-matrix card in that same block.
- No schema, RLS, or backend business-logic changes.
