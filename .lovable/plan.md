# ZNFA Release — Remove Mode Switch, Default to Release/Display/Approved List/Clarification

Simplify the ZNFA Release selection screen by removing the Creation / Release mode toggle and defaulting to a single set of action buttons: Release, Display, Approved List, and Clarification. Create and Change are to be temporarily removed from the UI by commenting them out, preserving their code for later reuse.

## Current state

- `src/routes/_authenticated/mm.znfa-release.tsx` has a `Mode` radio group (`creation` | `release`) and two action arrays: `CREATION_ACTIONS` (includes Create, Change, Clarification, Release, Display, Approved List) and `RELEASE_ACTIONS` (Release, Display, Approved List).
- The detail form renders for `Create`, `Change`, or confirmed `Display`.
- The Release/Approved List card renders for `Release` or `Approved List`.
- The Display card renders for `Display`.

## Plan

1. **Remove the mode toggle from the UI**
   - Comment out the entire `RadioGroup` block (Mode: Creation / Release) in the Selection Screen card.
   - Keep the `mode` state variable and `Mode` type at module scope to avoid cascading type errors, but default it to `"release"` so existing downstream logic for `Release`, `Display`, `Approved List` continues to work.

2. **Define a new default action list**
   - Add a constant `DEFAULT_ACTIONS = ["Release", "Display", "Approved List", "Clarification"]`.
   - Replace `const actions = mode === "creation" ? CREATION_ACTIONS : RELEASE_ACTIONS;` with `const actions = DEFAULT_ACTIONS;`.
   - Comment out `CREATION_ACTIONS` and `RELEASE_ACTIONS` declarations (or keep them unused but available) so the code remains for future reference.

3. **Preserve existing functionality for the four default buttons**
   - `Release` and `Approved List` still show the Release Code / Release Id card with the `Next` handler.
   - `Display` still shows the Main NFA Number card and, after Next, the full detail form.
   - `Clarification` triggers the existing `onAction` toast and does not render any extra card (consistent with how it behaved under Creation mode today).
   - Reset logic (`resetCreateForm`) continues to clear all form/selection state when any action changes.

4. **Comment out Create and Change (do not delete)**
   - In the actions map, do not render `Create` and `Change` buttons.
   - Leave the detail-form rendering logic unchanged (it still handles `action === "Create" || action === "Change"`) so re-enabling those buttons later requires only uncommenting the action names.

5. **Validation**
   - Verify the file builds (type-check) after the changes.
   - Confirm in the preview that the Selection Screen shows only Release, Display, Approved List, and Clarification buttons, with no Mode radio group.
