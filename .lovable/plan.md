## Change Gate Pass selection-screen fields to checkboxes

### Frontend — `src/routes/_authenticated/mm.gate-pass.tsx`

- Replace the three `Input` fields (SCM Head, Plant Head, Return Receipt) with `Checkbox` controls, styled identically to the existing HOD Approval / Store Approval checkboxes.
- State changes:
  - `scmHead`, `plantHead`, `returnReceipt` change from `useState("")` to `useState(false)`.
- On Execute, send `"X"` when checked and `""` when unchecked (same convention as `hod_approval` / `store_approval`).
- `reset()` sets all three back to `false`.

### Backend — `src/lib/mm/gate-pass.functions.ts`

- Update the input schema: `scm_head`, `plant_head`, `return_receipt` become `z.boolean().optional().default(false)`.
- In the payload builder, emit `SCM_HEAD`, `PLANT_HEAD`, `RETURN_RECEIPT` as `data.scm_head ? "X" : ""` (mirroring `HOD_APPROVAL` / `STORE_APPROVAL`).

### What is NOT changing

- API name (`Gate_Pass_Fetch_API`), proxy routing, response parsing, header/table rendering, Save button behaviour, and every other field on the screen remain untouched.
