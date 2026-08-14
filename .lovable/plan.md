## Global spacing & table header styling

### Goal
Tighten the overall page content spacing and replace the heavy dark table-header block with a light, neutral style that matches the clean porcelain theme. Apply the changes globally so every authenticated screen and table looks consistent, without changing any business logic or existing functionality.

### What will change

1. **Global page padding**  
   - File: `src/routes/_authenticated.tsx`  
   - Reduce the shared `<main>` wrapper padding so content sits closer to the edges. Current value is `p-3 lg:p-5`.  
   - Also tighten the `page-shell` and `card-pad` utility values in `src/styles.css` so the same spacing applies to screens that use those utilities.

2. **Light table header theme**  
   - File: `src/styles.css`  
   - Update the CSS variables used by the shared table header:  
     - `--table-header-bg` → a soft neutral gray (e.g., `#F0F2F7`)  
     - `--table-header-text` → dark graphite (e.g., `#111827`)  
     - `--table-header-border` → a subtle light border (e.g., `#E1E5EC`)  
   - Keep the sticky header behavior and row hover color unchanged.  
   - Provide equivalent dark-mode values in the `.dark` block so the theme remains consistent when dark mode is active.

3. **Verification**  
   - Typecheck the project after the edits.  
   - Check the current preview (`/mm/migo-release`) to confirm the reduced padding and lighter header are visible, then inspect one or two other screens to ensure the same global styling applies.

### Out of scope
No changes to screen logic, data fetching, SAP APIs, or component behavior. Only the layout wrapper padding and the table-header CSS variables will be modified.
