# ZNFA Display — show exact SAP MSG when STATUS is FALSE

Ensure the ZNFA Display step in `src/routes/_authenticated/mm.znfa-release.tsx` surfaces the exact `MSG` value from the `ZNFA_DISPLAY_GET_API` response whenever `STATUS: "FALSE"` is returned, with no generic or custom fallback text appended.

## Files to change

1. `src/lib/mm/znfa-display.functions.ts`
2. `src/routes/_authenticated/mm.znfa-release.tsx`

## Server-side changes

In `src/lib/mm/znfa-display.functions.ts`, inside the `if (!znfa)` block:

- When `payload.STATUS` is `"FALSE"` (case-insensitive), set `sapMessage` to exactly `payload.MSG` trimmed.
- Do **not** fall back to `"SAP rejected the request."` or any other custom text when `MSG` is present.
- If `MSG` is absent, leave `sapMessage` as `null` so the UI does not fabricate a message.
- Keep the sync log entry unchanged for debugging.

## UI changes

In `src/routes/_authenticated/mm.znfa-release.tsx`, inside `displayMutation.onSuccess`:

- Use only `res.sapMessage` (or `res.error` for non-SAP failures) when it is a non-empty string.
- Remove the hardcoded fallback text `"SAP returned no NFA document."` from the display error alert and toast so the user sees exactly the SAP message and nothing else on a `STATUS: "FALSE"` response.
- Keep the alert title **"Could not load the NFA document"**; only the description becomes the exact SAP `MSG`.

## Outcome

When the SAP response is:

```json
{"STATUS":"FALSE","MSG":"PR Data Not Available, Please Check RFQs", ...}
```

The UI shows:

```text
Could not load the NFA document
PR Data Not Available, Please Check RFQs
```

No default, custom, or prefixed text is added.
