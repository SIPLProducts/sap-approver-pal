# ZNFA Release — Display path toolbar + NFA Number F4 dropdown

Two presentation-only changes in the ZNFA Release screen.

## 1. Toolbar on the Display path

When the document was opened via the **Display** action, the top toolbar shows only:

```text
+--------------------------------------------+
| NFA <no> |  Back   Preview                 |
+--------------------------------------------+
```

- Hidden on the Display path: Approve, Reject, Clarification, Display Clarification.
- Back and Preview keep their current behaviour (Back returns to the Main NFA Number card).
- The Release / Approved List path keeps the full toolbar exactly as it is today.

## 2. Main NFA Number as a combobox dropdown

Change the Main NFA Number field to the same look and behaviour as the Plant field in PR Release:

- A single full-width outline combobox button showing the selected NFA number (or a "Select NFA number…" placeholder) with a chevron on the right — no separate text input plus icon button.
- Clicking it opens a searchable popover list of the NFA numbers returned by `ZNFA_NFA_GET_API` for the logged-in SAP user, with a tick beside the selected one.
- Loading, error (with Retry) and empty states rendered like the Plant dropdown; the SAP message is shown when SAP returns one.
- Selecting a value fills the field and closes the popover; picking the same value again clears it. Next stays disabled until a number is selected.

Everything else — the display fetch, mapping, and all detail cards — stays unchanged.

## Technical notes

- `src/components/mm/nfa-number-select.tsx`: replace the Input + icon-button pair with the PlantSelect-style `Popover` + `Command` combobox (same classes, sizes, and state handling); keep the existing `fetchZnfaNfaList` query and props.
- `src/routes/_authenticated/mm.znfa-release.tsx`: gate the four toolbar buttons on the document not having been opened via Display (reuse the existing `showDisplayStep` / opened-doc flags).
- No API, payload, or business-logic changes.
