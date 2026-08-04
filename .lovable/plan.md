# ZNFA Release — fetch release list on Next

Wire the Release step's **Next** button to the live SAP call instead of the placeholder toast.

## Behaviour

- Clicking **Next** (after choosing a Release Code) calls the configured `ZNFA_RELEASE_GET_API` with:
  `USER` = logged-in SAP user id, `REL_CODE` = selected Release Code, `RELEASE` = `"X"`, and `CREATE` / `CHANGE` / `APP_LIST` empty.
- While loading, the button shows a busy state and the results area shows a skeleton.
- **Success (array response)** — render a results table below the release card with columns:
  NFA No, Vendor Code, Purch. Group, Vendor Name, Plant, Plant Name, Vendor Rate, TER Rate, Total (right-aligned), Title, NFA Date, Release, Accept/Reject.
- **Failure (single object with `STATUS: "FALSE"`)** — no table at all; show the `MSG` text in a red alert box above where the table would be, plus an error toast. Same treatment for network/HTTP/JSON errors.
- Empty array → a plain "No records found" message, not an error.
- Changing action, plant or Release Code clears previous results and errors.

## Technical notes

- New `src/lib/mm/znfa-release.functions.ts` with `fetchZnfaRelease` server function, modelled on `src/lib/mm/po-release.functions.ts`: `requireSupabaseAuth`, Zod input (`user`, `relCode`), config lookup for `ZNFA_RELEASE_GET_API`, proxy/direct mode handling, sync-log inserts, and a return shape of `{ rows, error, sapMessage, fetched_at }`.
- Response handling: array (or `DATA`/`data` array) → `rows`; otherwise if the object has `STATUS === "FALSE"` → `sapMessage = MSG` with `rows: []`.
- `src/routes/_authenticated/mm.znfa-release.tsx`: replace `onReleaseNext` with a `useServerFn` + `useMutation` call, add `releaseRows` / `releaseError` state, and render the table with existing `Table` primitives and card styling.
- `ZNFA_RELEASE_GET_API` is already configured and active (POST), so no admin/API-settings changes are needed.
