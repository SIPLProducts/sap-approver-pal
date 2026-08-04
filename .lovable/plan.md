# ZNFA Release — Fully Remove the Mode Radio Buttons

## Current state

In `src/routes/_authenticated/mm.znfa-release.tsx` the Mode radio group (Creation / Release) is already wrapped in a JSX comment block (lines 331–354) and the action list is already `DEFAULT_ACTIONS = ["Release", "Display", "Approved List", "Clarification"]`. So the source no longer renders the radios — what the app still shows is most likely a stale preview/published build rather than live code.

## Plan

1. Delete the commented-out Mode radio block entirely (instead of leaving it as a comment), so there is no chance of it being reinstated or rendered.
2. Remove the now-unused `RadioGroup` / `RadioGroupItem` import and the unused `onModeChange` stub; keep the `mode` state defaulted to `"release"` since downstream logic reads it.
3. Keep all existing behaviour for Release, Display, Approved List, and Clarification untouched (Create / Change stay non-rendered, their form logic preserved).
4. Verify by loading the ZNFA Release screen in the running preview and confirming only the four buttons appear, with no Mode row; then recommend publishing so the live site picks up the change.

## Technical notes

Single file change: `src/routes/_authenticated/mm.znfa-release.tsx`. No backend, routing, or data-flow changes.
