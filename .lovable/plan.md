## Goal
Add a new "PO Release" screen under MM Approvals, listed immediately after "PR Release". Layout mirrors PR Release, with a Plant field (restricted to the logged-in user's assigned plants, matching Price Approvals) inserted as the first input, followed by Release Group and Release Code.

## New files

**`src/lib/mm/po-release.functions.ts`** — clone of `src/lib/mm/pr-release.functions.ts` with:
- `fetchPoReleaseMultiple` → SAP config `PO_Release_Multiple_Fetch_API`, payload `{ RELGROUP, RELCODE, PLANTS: string[] }` (server sends plants as `PLANT` per-row via `URLSearchParams` for direct mode / inputs object for proxy mode).
- `releasePoItems` → config `PO_Release_API`, payload key `RELEASE` with `{ EBELN, EBELP, REL_CODE, REL_GRP, REMARKS }` per item.
- `rejectPoItems` → config `PO_Reject_API`, same shape with `REJECT`.
- Item identifier fields: `EBELN` (PO Number) and `EBELP` (PO Item) instead of `PREQ_NO` / `PREQ_ITEM`.

Assumption: the three SAP API configs above already exist in Admin → SAP API. If names differ, they can be adjusted in one place (top constants).

**`src/routes/_authenticated/mm.po-release.tsx`** — clone of `mm.pr-release.tsx` with:
- `createFileRoute("/_authenticated/mm/po-release")`, component `PoReleasePage`.
- Import `PlantMultiSelect` and `useActiveContext`; add `plants` state seeded from `activePlants`, with the same "clip to allowed / fallback to all active" effect used in `sd.price.tsx`.
- Selection screen grid becomes `[280px_240px_240px_1fr_auto]`: Plant (required) → Release Group → Release Code → spacer → Execute/Reset.
- `execute()` validates at least one plant selected in addition to group/code, and passes `plants` to `fetchPoReleaseMultiple`.
- Row key uses `EBELN`/`EBELP`; column labels map PO fields (EBELN "PO Number", EBELP "PO Item", plus common fields — REMARKS stays editable like PR Release).
- Release/Reject mutations send `{ EBELN, EBELP, REMARKS }` items; success flow refetches with current plants+group+code and clears released/rejected rows.
- Page title: "PO Release".

## Menu / permissions

**`src/routes/_authenticated.tsx`** — add a nav entry immediately after the PR Release entry (line 157):
```
{ to: "/mm/po-release", label: "PO Release", icon: ClipboardCheck, screen: "approvals.inbox.mm" }
```
Reuses the existing `approvals.inbox.mm` permission key; no schema or role changes.

## Out of scope
- No changes to PR Release, other MM screens, middleware, or DB.
- No new permission/screen key.
- No new SAP API config rows; user must ensure `PO_Release_Multiple_Fetch_API`, `PO_Release_API`, `PO_Reject_API` are configured (or tell me the actual names to wire in).

## Confirm before build
- Are the SAP API config names `PO_Release_Multiple_Fetch_API` / `PO_Release_API` / `PO_Reject_API`, and are the PO document/item fields `EBELN` / `EBELP`? If different, share the names and I'll wire them in.
