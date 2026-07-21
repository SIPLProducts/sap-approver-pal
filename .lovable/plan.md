## Problem

In Gate Pass save, `GATE_PASS_TYPE` in the outgoing payload is empty. The fetch response header uses the SAP key `GATEPASS_TYPE` (matching the sibling `GATEPASS_NUMBER` / `GATEPASS_DATE` naming), but both the client and server read `GATE_PASS_TYPE`, so the value is never picked up.

## Fix

Read the value from either key when building the save payload, without touching fetch logic or any other field.

1. `src/routes/_authenticated/mm.gate-pass.tsx` — in the `saveMutation` header mapping, change:
   ```ts
   GATE_PASS_TYPE: h.GATE_PASS_TYPE ?? "",
   ```
   to:
   ```ts
   GATE_PASS_TYPE: h.GATE_PASS_TYPE ?? h.GATEPASS_TYPE ?? "",
   ```

2. `src/lib/mm/gate-pass.functions.ts` — in `saveGatePass` handler, when building `payload`, change:
   ```ts
   GATE_PASS_TYPE: h.GATE_PASS_TYPE ?? "",
   ```
   to:
   ```ts
   GATE_PASS_TYPE: (h.GATE_PASS_TYPE ?? (h as any).GATEPASS_TYPE ?? ""),
   ```
   (schema already `.passthrough()`, so `GATEPASS_TYPE` survives validation.)

No changes to fetch, business logic, UI, or other fields.

## Verification

Execute Gate Pass, select rows, Save, and confirm the outgoing SAP payload now contains the correct `GATE_PASS_TYPE` value from the header.