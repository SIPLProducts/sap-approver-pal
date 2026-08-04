# ZNFA error messages — show only SAP MSG

Clean up the failure messages for both ZNFA_RELEASE_GET_API and ZNFA_DISPLAY_GET_API so users see only the SAP `MSG` value (e.g. *PR Data Not Available, Please Check RFQs.*), never raw JSON, HTTP bodies, or trace details.

## Files to change

1. `src/lib/mm/znfa-release.functions.ts`
2. `src/lib/mm/znfa-display.functions.ts`
3. `src/routes/_authenticated/mm.znfa-release.tsx` (if needed to ensure UI renders MSG-only text)

## Server-side changes

For both functions, introduce a small helper that extracts `MSG` from a raw response text (via JSON parse or a fallback regex), and use it in every failure branch that currently returns raw JSON:

- HTTP non-2xx (`!res.ok`): return `fail(null, extractMsg(text) ?? "SAP returned an error")` instead of `SAP returned ${status}: ${text}`.
- Invalid JSON: return `fail(null, extractMsg(text) ?? "Invalid response from SAP")` instead of `Invalid JSON from SAP: ${text}`.
- Unexpected shape / no `ZNFA` object and no `STATUS: "FALSE"`: try `extractMsg(text)` first, then fall back to a generic message.

The sync log will continue to record the full HTTP status and raw body for debugging; only the user-facing `sapMessage` becomes clean.

## UI changes

In `src/routes/_authenticated/mm.znfa-release.tsx`, ensure the display and release error alerts keep their existing titles:

- Display: **"Could not load the NFA document"**
- Release: **"Could not load ZNFA records"**

The `AlertDescription` renders only the `sapMessage` value. If the server function happens to throw, catch and map to a generic message instead of surfacing the trace.

## Outcome

Users see a single, clean SAP message such as:

```text
Could not load the NFA document
PR Data Not Available, Please Check RFQs.
```

No raw JSON, URLs, or stack traces are exposed in the UI.
