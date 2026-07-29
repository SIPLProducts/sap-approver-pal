The MIGO Release success popup currently formats the response with friendly labels and should not show raw SAP keys. I will verify and, if needed, make the smallest adjustment to match the requested output exactly.

1. Inspect the `postMutation.onSuccess` handler in `src/routes/_authenticated/mm.migo-release.tsx` and the `postMigo` return shape in `src/lib/mm/migo-release.functions.ts`.
2. Ensure the SweetAlert2 popup only shows:
   - The SAP response message (e.g., "Material document posted successfully")
   - "Material Document: <value>"
   - "Document Year: <value>"
   and never displays raw keys like `TYPE`, `MESSAGE`, `MAT_DOC`, or `DOC_YEAR`.
3. If the popup is not already multi-line as shown in the example, switch the text body to render line breaks correctly while keeping the same content.
4. Run a quick code review to confirm no other MIGO success/error dialog still shows raw key names.

If the existing code already matches, no file edits will be made beyond the minimal formatting adjustment.