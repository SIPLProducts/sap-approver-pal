# Redesign Users tab (User & Role Management)

Restyle only the **Users** tab in `src/routes/_authenticated/admin.users.tsx` to match the attached mockup. No changes to colors, fonts, data model, or other tabs (Custom Roles, Role Permissions, Approval Matrix).

## Visual changes

1. **Page header** (above the Tabs)
   - Add a small users-with-gear icon next to the title "User & Role Management".
   - Update subtitle to: "Create user accounts, assign roles (from Role Management), and manage access".
   - Right side: add a primary **Create User** button (opens existing Invite dialog) and a **Refresh** outline button (invalidates the user queries). Keep the existing Tenant scope dropdown but move it into the Users panel toolbar so the header matches the mockup.

2. **KPI row** (4 cards, visible only when the Users tab is active)
   - Total Users — count of `profiles`
   - Administrators — users with `super_admin`/`admin` role
   - Role Heads — users with any role ending in `_head` (or holding any built-in approver role; computed from `user_roles`)
   - Unassigned — users with no row in `user_roles` and no `user_custom_roles`
   - Each card: soft tinted square icon (using existing muted/primary/accent/destructive tokens), big number, label underneath. Reuse the existing `Card` component.

3. **Users panel** (single card replacing the current toolbar+table card)
   - Header row inside the card: left = "Users" title + "View and manage user roles" subtitle; right = Plant/Tenant select + Search input with leading icon.
   - Table columns reordered/renamed to: **Name | Employee ID | Email | Plants | Role | Actions**.
     - Employee ID: from `profiles.employee_id` if available, else `—`.
     - Plants: render each assigned tenant code as a small rounded outline chip (e.g. `1300`). Use the existing `tenantLinks` data; show chips inline, wrap on overflow.
     - Role: render the user's primary role as a single filled pill. Color via existing semantic tokens (no new hex):
       - `super_admin` / `admin` → `bg-primary text-primary-foreground`
       - other built-in roles → `bg-secondary text-secondary-foreground`
       - custom role only → `bg-accent text-accent-foreground`
       - none → muted "—"
     - Actions: keep current behavior but render as **Edit** outline button (opens existing role popover) + small red trash icon button (existing delete handler).
   - Remove the standalone "Custom Roles" and "Joined" columns from this view to match the mockup; that data stays accessible via the Custom Roles tab and the Edit popover.

4. **Toolbar polish**
   - Search input: full-width on the right side of the panel header, leading magnifier icon, rounded.
   - Plant select replaces the previous "All roles" filter inside this card (per mockup). Move the role filter into the Edit popover or drop it for now — confirm below.

## Out of scope

- No DB migrations, no server function changes.
- No edits to other tabs.
- No new color tokens; reuse `bg-primary`, `bg-secondary`, `bg-accent`, `bg-muted`, `border`, `text-muted-foreground` etc. from `src/styles.css`.

## Open question

The mockup replaces the "All roles" filter with a Plant filter. OK to drop the role filter from the Users tab toolbar (since Tenant/Plant filter takes its slot), or should I keep both side by side?
