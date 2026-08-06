# ZNFA Release — toolbar trim, Proposed to Award binding, Selection Screen cleanup

Presentation-only changes in `src/routes/_authenticated/mm.znfa-release.tsx`.

## 1. Approved List document toolbar

When an NFA opened from the **Approved List** results is shown, the toolbar keeps only **Back** and **Preview**. Approve, Reject, Clarification and Display Clarification are hidden — same as the Display path today. The Release path keeps its full toolbar.

```text
+-----------------------------------+
| NFA <no> |  Back   Preview        |
+-----------------------------------+
```

## 2. Proposed to Award bound to NFA_TEXTS

From the `NFA_TEXTS` array of the document response (Release click, Display, and Approved List click all share one mapping):

- First field ← `VENDOR`
- Second field ← `NAME1`

Taken from the first NFA_TEXTS entry that carries these values; both fields stay empty when the response has none, and reset with the existing form reset. Fields remain editable as they are today.

## 3. Selection Screen

Remove the **Clarification** button from the action buttons in the SELECTION SCREEN card, leaving Release, Display and Approved List.

## Technical notes

- Toolbar gate: extend the existing `!showDisplayStep` condition on the four buttons to also exclude the Approved List action (`action === "Approved List"`).
- Binding: inside `applyZnfaDocument`, read the raw `res.nfaTexts` (not the `AVL_TEXTS`-filtered `nfaTextRows`) and set `proposedToAward` / `proposedToAwardDetail`.
- Selection screen: drop `"Clarification"` from `DEFAULT_ACTIONS`.
- No API, payload, schema or business-logic changes.
