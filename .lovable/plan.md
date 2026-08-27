# Keep confirmations only on Reject / UnRelease

## Goal
Across MM Approvals, only the Reject and UnRelease actions show a SweetAlert confirmation popup. All other actions (Release, Post, Save, Approve) fire immediately on click, exactly as they did before the confirmations were added.

## Changes (remove the confirm guard, keep everything else identical)

| File | Action | What happens |
|---|---|---|
| `src/routes/_authenticated/mm.po-release.tsx` | Release (~line 273) | Remove `swalConfirm` block; release mutation runs directly |
| `src/routes/_authenticated/mm.pr-release.tsx` | Release (~line 352) | Same |
| `src/routes/_authenticated/mm.service-entry-sheet.tsx` | Release (`doRelease`, ~line 429) | Same |
| `src/routes/_authenticated/mm.migo-release.tsx` | Post (~line 164) | Same |
| `src/routes/_authenticated/mm.material-reservation.tsx` | Save (`doSave`, ~line 173) | Same |
| `src/routes/_authenticated/mm.znfa-release.tsx` | Approve (~line 1323) | Same |
| `src/routes/_authenticated/mm.gate-process.tsx` | Save (`doSave`, ~line 252) | Same |
| `src/routes/_authenticated/mm.gate-pass.tsx` | Save (~line 261) | Same |

## Kept unchanged
- Reject confirmations: PO Release, PR Release
- UnRelease confirmation: Service Entry Sheet
- All SAP response SweetAlert popups (success/error messages), payloads, mutations, refresh logic, and result handling — byte-identical behavior.
- Files where the only `swalConfirm` usage is removed also drop the now-unused import.

## Technical notes
- Only the `swalConfirm(...)` guard blocks are removed; the async wrapper structure is simplified where it becomes redundant (e.g. `void (async () => { const ok = await swalConfirm...; if (!ok) return; ... })()` collapses to a direct mutation call) without changing any logic inside.
- No API, schema, or styling changes.
