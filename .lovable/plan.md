# SAP API Settings — API count on the APIs tab

## What
On the SAP API Settings screen, the APIs tab gets a visible total count of configured APIs (e.g. "12 APIs"), shown near the "New endpoint" button at the top of the tab. The count is derived from the same list that renders the endpoint cards, so it updates automatically whenever APIs are added, deleted, or refreshed.

## Where
`src/routes/_authenticated/admin.sap-api.index.tsx` — `ApisTab` component only.

## How
- The tab already loads all configs via the existing `useQuery(["sap-configs"])` (from `listSapConfigs`); no new server calls.
- Render a small count indicator in the top row (same flex row as the "New endpoint" button, aligned left) showing `data?.configs.length` — e.g. `N APIs` — hidden while loading, consistent with the current styling tokens (Badge / muted text). Show "0 APIs" on the empty state.
- No changes to the API list rendering, create/edit/delete/test flows, or any other tab.

## Verification
- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`) and build log clean.
- Preview: open SAP API Settings → APIs tab, confirm count matches the number of cards; delete or add an endpoint and confirm it updates.
