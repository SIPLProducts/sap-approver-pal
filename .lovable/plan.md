## Problem

SAP middleware returned:
```
{"status":"ERROR","message":"ROLE and ACTIVITY are mandatory","number":"100"}
```
…but the app showed "Role created successfully" and inserted DB rows.

Root cause is in `createCustomRoleViaSap` (`src/lib/admin/user-mgmt.functions.ts`, lines ~412–414):

```ts
const statusStr = String(sapBody?.STATUS ?? "").toUpperCase();
const success = result.ok && (statusStr === "SUCCESS" || statusStr === "TRUE" || statusStr === "");
```

The handler only reads UPPERCASE keys (`STATUS`, `MESSAGE`, `NUMBER`). SAP returned **lowercase** (`status`, `message`, `number`), so `statusStr` became `""` → treated as success → DB inserts + success toast, even though SAP rejected the request.

## Fix (scoped, presentation/handler logic only)

Edit `createCustomRoleViaSap` to read SAP fields case-insensitively and treat `ERROR` (or any non-success value) as failure.

1. Add a small local helper to pick a field regardless of case:
   ```ts
   const pick = (obj: any, ...keys: string[]) => {
     for (const k of keys) {
       if (obj?.[k] !== undefined) return obj[k];
       if (obj?.[k.toLowerCase()] !== undefined) return obj[k.toLowerCase()];
       if (obj?.[k.toUpperCase()] !== undefined) return obj[k.toUpperCase()];
     }
     return undefined;
   };
   ```
2. Replace the status/success block:
   ```ts
   const rawStatus = pick(sapBody, "STATUS");
   const statusStr = String(rawStatus ?? "").toUpperCase();
   const sapMessage = pick(sapBody, "MESSAGE");
   const sapNumber  = pick(sapBody, "NUMBER");
   // explicit ERROR/FAIL is a failure; SUCCESS/TRUE pass; empty only passes if HTTP ok and no message that looks like an error
   const isExplicitError = statusStr === "ERROR" || statusStr === "FAIL" || statusStr === "FAILURE" || statusStr === "FALSE";
   const isExplicitSuccess = statusStr === "SUCCESS" || statusStr === "TRUE" || statusStr === "S" || statusStr === "OK";
   const success = result.ok && !isExplicitError && (isExplicitSuccess || statusStr === "");
   ```
3. Use `sapMessage` / `sapNumber` (instead of `sapBody?.MESSAGE` / `sapBody?.NUMBER`) in:
   - the error throw: `const msg = sapMessage || result.error || ...`
   - the success return: `message: String(sapMessage ?? ...)`, `number: sapNumber ?? null`
4. Apply the same case-insensitive read in `createUserViaSap` (same file) so user-create surfaces SAP errors consistently. No payload/schema changes.

## Out of scope

- Why SAP says "ROLE and ACTIVITY are mandatory" (likely a payload-shape mismatch with this SAP endpoint). After this fix the real error will surface in the UI and we can iterate on the payload shape in a follow-up.
- No DB schema, RLS, or UI changes.
