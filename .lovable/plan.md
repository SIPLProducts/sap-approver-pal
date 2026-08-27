# Gate Pass — Skip Gate_Pass_Doc_F4_API on Return Receipt

## Current state

The Gate Pass screen maps the selection-screen flag to an F4 flag used by `GatePassNumberSelect`:

- `flag === "return"` → `f4Flag = ""`
- `GatePassNumberSelect` disables its `useQuery` when `flag === ""` (`enabled = !!userId.trim() && flag !== ""`).

So the `Gate_Pass_Doc_F4_API` is already not called for Return Receipt.

## Proposed change

No functional code change is required. To keep the intent clear and guard against future regressions:

1. In `src/routes/_authenticated/mm.gate-pass.tsx`, add an inline comment above the `f4Flag` derivation noting that Return Receipt intentionally maps to an empty F4 flag so no document F4 is triggered.
2. Do not change checkbox behavior, single-selection logic, Execute/Save payloads, table locking, or any other existing logic.

## Verification

- Select Return Receipt on the Gate Pass screen and confirm no network request is sent to `Gate_Pass_Doc_F4_API`.
- Select HOD / Store / SCM / Plant Head and confirm the F4 dropdown still populates as before.
