# MIGO Cancel API integration

## What changes

When Transaction Type is **Cancel** on the MIGO Release screen, the red **Cancel** button calls the new cancel API instead of the existing post API, and the SAP message is shown in the usual response popup.

## Server function

New `cancelMigo` in `src/lib/mm/migo-release.functions.ts`, modelled exactly on the existing `postMigo`:

- Config name `MIGO_CANCEL` (looked up in SAP API Settings, case-insensitive fallback to `MIGO_CANCEL_API`).
- Input: `{ mblnr: string, mjahr: string }`.
- Payload: `{ "cancel": { "mblnr": "...", "mjahr": "..." } }`.
- Same credential / proxy / middleware resolution and sync-log writes as `postMigo`; HTTP method comes from the config (PUT).
- Response is an array — read the first element, extract `TYPE` and `MESSAGE` verbatim, `ok = TYPE === "S"`, return `{ ok, type, message, raw }`.

## Screen

In `src/routes/_authenticated/mm.migo-release.tsx`:

- Add a `cancelMutation` using `cancelMigo`.
- The Cancel button (already shown for `transactionType === "cancel"`) calls the cancel flow with the entered Material Document Number / Year instead of `onPost`, and shows only the exact `MESSAGE` in `SapResponseDialog`. On success the screen clears the same way a successful post does.
- Post behaviour for Release stays exactly as today; Display still shows no action button.

## Untouched

`fetchMigo`, `checkMigo`, `saveMigo`, `postMigo`, transaction-type flags, table columns, header/custom-field cards, validations and styling.

## Verification

Typecheck (`bunx tsgo --noEmit`), and confirm Release/Display behave as before.
