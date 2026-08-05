# ZNFA Display — Main NFA Number F4 dropdown

Confirmed: the SAP API config `ZNFA_NFA_GET_API` exists and is active (HTTP method PUT).

## Behaviour

In the ZNFA Release screen, on the **Display** card, the Main NFA Number field becomes a searchable dropdown (F4) instead of a plain text box.

- Options load from `ZNFA_NFA_GET_API` with payload `{ "USER": "<logged-in SAP user id>" }`, taken from the stored SAP login profile (same source the Release step uses for Release ID).
- Response is a flat array of `{ "NFA_NO": "..." }`; each `NFA_NO` becomes one option.
- The dropdown shows a loading state while fetching, a type-to-filter search box, and "No NFA numbers found" when the list is empty.
- If SAP fails or returns `STATUS: "FALSE"`, show only the SAP `MSG` text (toast + inline hint), consistent with the other ZNFA calls.
- Selecting a value sets Main NFA Number and clears the confirmed flag; **Next** stays disabled until a value is selected and continues to call `ZNFA_DISPLAY_GET_API` exactly as today.
- Free typing is still allowed as a fallback so the field never blocks a user whose list is empty.

Everything else on the screen (Release, Approved List, Clarification, detail cards, toolbar) stays unchanged.

## Technical notes

- New server function `src/lib/mm/znfa-nfa-list.functions.ts`, modelled on `znfa-release.functions.ts`: `requireSupabaseAuth`, zod-validated `{ user }`, loads config `ZNFA_NFA_GET_API` + credentials + global proxy settings, posts through middleware `/sap/invoke` with `raw: true` when proxy mode is on (otherwise direct with the config's own HTTP method), logs to `sap_api_sync_log`, returns `{ options: string[], error, sapMessage, fetched_at }`.
- `src/routes/_authenticated/mm.znfa-release.tsx`: replace the Main NFA Number `Input` with a Popover + Command combobox (same primitives as `search-term-multi-select.tsx`), fed by a `useQuery` on the new server function keyed by the SAP user id and enabled only while the Display step is visible.
- No schema, RLS, or business-logic changes.
