## Scope
Move the "Create User" and "Refresh" action buttons from inside the **Users** tab content up to the page header row, so they sit to the right of the "User & Role Management" heading.

## Why
The reference layout places primary page-level actions at the top-right of the screen, aligned with the page title, rather than nested inside a tab panel.

## Changes
1. **Lift state & handlers**  
   The invite dialog state (`inviteOpen`), the `refreshAll` callback, and the `submitInvite` handler currently live inside `UsersTab`. These need to be hoisted to `UserManagementPage` so the header can own the buttons.

2. **Move buttons to header**  
   In `UserManagementPage` header (the `flex` row that already contains the title and the conditional tenant scope), add the **Create User** and **Refresh** buttons on the right side.  
   - Show them **only when the active tab is `users`**, so they don’t appear on Custom Roles / Permissions / Matrix tabs where they have no context.

3. **Remove duplicate button row from `UsersTab`**  
   Delete the old action-bar div (lines ~236–270 in the current file) from inside the Users tab panel.

## Technical notes
- The invite dialog markup (`Dialog` + `DialogContent`) will move with the "Create User" button into the header area.
- `refreshAll` and `submitInvite` will be defined in `UserManagementPage` and passed down to `UsersTab` if it still needs to trigger refreshes; or `UsersTab` can call `qc.invalidateQueries` directly for local edits.
- No new dependencies; no DB or server-function changes.

## Acceptance criteria
- "Create User" and "Refresh" buttons render at the top-right of the page, aligned with the "User & Role Management" title.
- Buttons are visible only on the **Users** tab.
- Buttons are removed from the old position inside the Users panel.
- Invite dialog and refresh behavior continue to work.