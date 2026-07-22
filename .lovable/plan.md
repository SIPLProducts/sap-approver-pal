## Goal
Update the ZNFA Rating screen so the output card title reflects the action that triggered the API, and remove the "Rating triggers the ZNFA_Create_API" caption.

## Changes to `src/routes/_authenticated/mm.gate-process.tsx`

1. Track the action that produced the output
   - Add a state: `const [lastAction, setLastAction] = useState<ZnfaAction | null>(null);`
   - Reset it on `Execute`/`Reset`/`onSuccess` of the fetch mutation.
   - Set it inside `createMutation.onSuccess` before storing the output, e.g.:
     ```ts
     setLastAction(createMutation.variables?.action ?? null);
     ```
     (Store it from the mutation variables because the action was already passed to `handleAction`.)

2. Dynamic output title
   - Derive the title from `lastAction`:
     ```ts
     const outputTitle = useMemo(() => {
       switch (lastAction) {
         case "RATE": return "Rating Result";
         case "CHANGE": return "Change Result";
         case "DISPLAY": return "Display Result";
         default: return "Output";
       }
     }, [lastAction]);
     ```
   - Replace the static `OUTPUT` card label (lines 235–237) with:
     ```tsx
     <Filter className="h-3.5 w-3.5" /> {outputTitle}
     ```

3. Remove the API caption
   - Delete lines 229–231 (the `<div className="text-xs text-muted-foreground -mt-2">…` caption).
   - Remove the `title={action === "RATE" ? "Triggers ZNFA_Create_API" : undefined}` tooltip from the Rating button (line 218) so no leftover indication remains.

4. Reset state consistency
   - Ensure `setLastAction(null)` is called in the fetch mutation `onSuccess` and in the `reset()` function.

## Out of scope
- No changes to the SAP API payload or server functions.
- No changes to the table layout, button colors, or editable Remarks behavior.
- No new routes or components.