# Gate Pass — single-select checkboxes + Gate Pass Number F4

## 1. Checkboxes become single selection

On the Gate Pass selection screen, HOD Approval, Store Approval, SCM Head, Plant Head and Return Receipt behave as one mutually exclusive group: ticking one clears the others, and clicking the ticked one again clears it. Layout, labels and Execute/Reset stay exactly as they are, and the payload sent to the fetch API keeps its current shape (the chosen flag `X`, the rest blank).

## 2. Gate Pass Number becomes a searchable F4 dropdown

When a checkbox is selected, the app calls the `Gate_Pass_Doc_F4_API` config from SAP API Settings with:

```text
{ "USER_ID": "<logged-in SAP user id>", "HOD": "", "STORES": "", "SCM": "", "PLANT": "X" }
```

- `USER_ID` is taken automatically from the logged-in user's SAP ID (already resolved on this screen).
- Exactly one of `HOD` / `STORES` / `SCM` / `PLANT` is `X`, matching the ticked checkbox: HOD Approval to `HOD`, Store Approval to `STORES`, SCM Head to `SCM`, Plant Head to `PLANT`. Return Receipt has no corresponding key in the payload structure, so it is sent with all four keys blank.
- The returned `UNIQUE_NO` values fill the Gate Pass Number field as F4 options in a dropdown with a type-to-search box, matching the look of the existing NFA Number / Release Key selects.
- Clearing the checkbox clears the option list; the Gate Pass Number field remains usable as before.

## 3. Failure responses

If the API responds with a failure (for example "Data is not available", `TYPE: "E"`, `STATUS: "FALSE"`, or a MESSAGES array error), the exact SAP message text is shown in the existing Gate Pass response popup and the option list stays empty. Nothing is invented or reworded.

## Technical notes

- New server function `fetchGatePassDocF4` in `src/lib/mm/gate-pass.functions.ts`, following the existing config lookup / proxy / basic-auth and sync-log pattern of `fetchGatePass`, reusing `collectSapMessages` and `extractSapMessage` from `src/lib/mm/sap-message.ts` for failure text. Response may be a bare array or wrapped (`DATA`/`data`); both handled.
- New `src/components/mm/gate-pass-number-select.tsx` searchable combobox, modelled on `src/components/mm/nfa-number-select.tsx`.
- `src/routes/_authenticated/mm.gate-pass.tsx`: replace the five independent checkbox states with one selection value, swap the Gate Pass Number `Input` for the new select, and trigger the F4 query on selection change. Existing fetch/save logic, table rendering and dialogs untouched.
- No database, RLS or SAP config changes; the `Gate_Pass_Doc_F4_API` entry must already exist in Admin → SAP API.
