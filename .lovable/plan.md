# Load Plants, Roles & Screens from SAP Login Response

The SAP `Login_API` already returns the full authorization tree:

```json
{
  "USER": "SARVI_INFO1",
  "FIRST_NAME": "...", "LAST_NAME": "...", "EMAIL": "...",
  "PLANTS": [
    { "PLANT": "3801",
      "ROLES": [
        { "ROLE": "RESL_ADMIN",
          "ACTIVITIES": [
            { "ACTIVITY": "ADMIN.APPROVAL_MATRIX", "RELEASE_CODE": "ad" },
            { "ACTIVITY": "APPROVALS.DETAIL",      "RELEASE_CODE": "ap" },
            ...
          ]
        }
      ]
    }
  ]
}
```

Today this payload is discarded after the auth handshake and the UI falls back to Supabase tables (`user_tenants`, `user_roles`, `user_custom_roles`, `role_permissions`), so the plant dropdown is empty, no role appears, and every screen is hidden. We will switch the top bar and screen-gating to read the SAP payload directly.

## What to build

### 1. Return SAP profile from `sapLogin`
`src/lib/auth/sap-login.functions.ts`
- After a successful SAP call, extract the user record (handle both the bare object and common wrappers like `{ data: {...} }` / `{ LOGIN: {...} }`).
- Normalize into:
  ```ts
  type SapProfile = {
    user: string;
    firstName?: string; lastName?: string; email?: string;
    status?: string; contact?: string;
    plants: Array<{
      code: string;            // PLANT
      name?: string;           // PLANT_NAME if present
      roles: Array<{
        role: string;          // ROLE
        label?: string;        // ROLE_DES if present
        activities: string[];  // ACTIVITY codes, uppercased
      }>;
    }>;
  };
  ```
- Add `profile?: SapProfile` to the existing `SapLoginResult` and return it alongside `email`/`tokenHash`. No DB writes.

### 2. Persist the profile on the client
`src/routes/login.tsx`
- Right after `verifyOtp` succeeds, if `result.profile` is present, `localStorage.setItem("sap.profile", JSON.stringify(result.profile))`.
- On `logout` (in `_authenticated.tsx`), `localStorage.removeItem("sap.profile")` plus the existing `app.activePlant` / `app.activeRole` keys.

### 3. New hook `useSapProfile`
`src/hooks/use-sap-profile.ts` (new)
- Reads `sap.profile` from `localStorage`, exposes `{ profile, plants, rolesFor(plantCode), activitiesFor(plantCode, role) }`.
- Listens to `storage` events so login updates propagate.

### 4. Replace data source in `use-active-context.tsx`
- Drop the three Supabase queries (`my-plants`, `my-built-roles`, `my-custom-roles`).
- Plants come from `profile.plants` (code + optional name).
- Roles come from the roles of the currently selected plant (so changing plant rescopes the role dropdown). All SAP roles use a new kind:
  ```ts
  type ActiveRole = { kind: "sap"; value: string; label: string };
  ```
  The old `"built_in" | "custom"` shape is removed; persisted `app.activeRole` entries with the old shape are ignored and re-defaulted.
- When the active plant changes and the current role is not present under it, auto-pick the first role of the new plant.

### 5. Rewrite `use-permissions.ts`
- Remove the `role_permissions` query.
- `allowedScreens` = the active role's `activities` mapped to screen keys: lowercase the activity (`ADMIN.USERS` → `admin.users`). Built `Set<string>`.
- `can(screen, action="view")` returns `allowedScreens.has(screen)`. Action-level gating is not present in the SAP payload, so view-permission implies all actions on that screen (matches existing sidebar usage).
- `isAdmin` = the active role contains `ADMIN.USERS` AND `ADMIN.ROLE_PERMISSIONS` activities (covers `RESL_ADMIN` without hard-coding role names).
- `activeRoleLabel` = role label from the SAP payload.

### 6. Sidebar / route gating
`src/routes/_authenticated.tsx`
- No structural change: existing `can(...)` filtering on `sdChildren` and `manage_items` already drives the sidebar, so dynamic screens "just work" once `usePermissions` reads from SAP.
- Plant dropdown options now come from `ctx.plants` (SAP). Selecting a plant triggers `qc.invalidateQueries()` (already in place) so inbox/history refetch.
- `src/routes/index.tsx` first-allowed-screen redirect already iterates `allowedScreens` — no change needed.

### 7. Role create/edit: empty `RELEASE_CODE`
`src/lib/admin/user-mgmt.functions.ts`
- Lines 427-430 and 843-846: change
  ```ts
  ACTIVITY: uniqueScreens.map((k) => ({ ACTIVITY: k.toUpperCase(), RELEASE_CODE: k }))
  ```
  to
  ```ts
  ACTIVITY: uniqueScreens.map((k) => ({ ACTIVITY: k.toUpperCase(), RELEASE_CODE: "" }))
  ```

## Out of scope
- No DB schema changes. `user_tenants` / `user_roles` / `role_permissions` tables stay (still used by admin screens / approval matrix). Only the runtime *gating* of the logged-in user's UI switches to the SAP payload.
- The Supabase magic-link session is still used for auth + RLS. The SAP profile only drives Plant/Role/Screen visibility.
- Google sign-in users (no SAP profile in storage) keep the Admin/full-access behavior they have today.

## Files touched
- edit `src/lib/auth/sap-login.functions.ts` (parse + return profile)
- edit `src/routes/login.tsx` (persist profile on success)
- new  `src/hooks/use-sap-profile.ts`
- edit `src/hooks/use-active-context.tsx` (SAP-backed plants/roles)
- edit `src/hooks/use-permissions.ts` (activities → allowedScreens)
- edit `src/routes/_authenticated.tsx` (clear `sap.profile` on logout)
- edit `src/lib/admin/user-mgmt.functions.ts` (RELEASE_CODE: "")
