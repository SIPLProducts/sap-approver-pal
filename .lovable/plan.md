## Goal

Release Group and Release Code on PR Release and PO Release become dropdowns (F4) populated from the `Login_API` response, filtered to the plant selected in the top bar — PR uses `PR_KEYS`, PO uses `PO_KEYS`. No SAP call, no change to execute/release/reject payloads or logic.

## What I verified

- `src/lib/auth/sap-login.functions.ts` currently parses only `USER`, name/email/status/contact and `PLANTS[].ROLES[].ACTIVITIES[]`. `PR_KEYS`, `PO_KEYS`, `NFA_KEYS`, `SES_KEYS` are dropped today.
- The parsed profile is stored in `profiles.sap_profile` and in browser storage under `sap.profile` (`src/hooks/use-sap-profile.ts`), then exposed by `src/hooks/use-active-context.tsx` (`plants`, `activePlants`, `activePlant`).
- Both screens today render plain text `Input`s for Release Group / Release Code (`mm.pr-release.tsx` ~lines 347-365, `mm.po-release.tsx` ~lines 360-378). PO already has a Plant multi-select seeded from `activePlants`; PR has no plant field.

## Changes

1. **Capture the keys at login** (`src/lib/auth/sap-login.functions.ts`)
   - In the plant loop, additionally read `PR_KEYS`, `PO_KEYS`, `NFA_KEYS`, `SES_KEYS`, each normalized to `{ relGroup, releaseCode }[]` (tolerant of casing/single-object shapes, same style as existing helpers). Empty arrays stay empty.
   - Extend `SapProfilePayload.plants[]` with these four key lists.

2. **Type + expose in the client profile**
   - `src/hooks/use-sap-profile.ts`: add optional `prKeys`, `poKeys`, `nfaKeys`, `sesKeys` to `SapProfilePlant`.
   - `src/hooks/use-active-context.tsx`: carry the key lists through `AssignedPlant`, and add a small helper `releaseKeysFor(kind, plantCodes)` returning the de-duplicated release groups and, for a chosen group, its release codes for those plants.

3. **Shared F4 component** — `src/components/mm/release-key-select.tsx`
   - Two `Select` dropdowns (Release Group, Release Code) driven by the key list passed in. Release Group lists distinct `REL_GROUP` values (a blank `REL_GROUP`, as PR/NFA sometimes returns, is shown as an "(blank)" option that submits `""`). Release Code lists the codes belonging to the chosen group; changing group resets the code. If no keys exist for the plant, the dropdown shows "No keys assigned" and stays empty.

4. **PR Release** (`src/routes/_authenticated/mm.pr-release.tsx`)
   - Replace the two Inputs with the new component, sourcing `PR_KEYS` for the plants active in the top bar (`activePlants`; primary `activePlant` when a single plant is required). `releaseGroup` / `releaseCode` state, validation and mutation payloads are untouched.

5. **PO Release** (`src/routes/_authenticated/mm.po-release.tsx`)
   - Same replacement, sourcing `PO_KEYS` for the plants selected in the screen's existing Plant multi-select; when the plant selection changes, options refresh and any now-invalid group/code selection is cleared.

## Note

Key lists only exist in the profile after a fresh login, so a user already signed in must log out and back in once to see values.
