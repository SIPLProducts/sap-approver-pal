## Change

In `src/routes/_authenticated/sd.bmw-status.tsx`, remove the mandatory validation for "Sales Organization To". "Sales Organization From" remains required. If "To" is empty, it will continue to default to the "From" value (existing fallback already in place at line 278 and in the backend).

### Edits (UI-only)

1. **Line 309** — remove the guard:
   ```ts
   if (!salesOrgTo.trim()) return toast.error("Select Sales Organization To");
   ```

2. **Line 331** — `canExecute` no longer requires `salesOrgTo`:
   ```ts
   const canExecute = !!salesOrgFrom && !mutation.isPending;
   ```

3. **Line 359** — drop the red asterisk on the "Sales Organization To" label:
   ```tsx
   <Label className="text-xs">Sales Organization To</Label>
   ```

No changes to server functions or business logic — the existing `sales_org_to || sales_org_from` fallback keeps the SAP request identical when "To" is left blank.
