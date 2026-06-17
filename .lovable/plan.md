## Root cause

I inspected the saved credentials and found this:

| Config | Saved username | Saved password |
| --- | --- | --- |
| `Get_Plant` | *(blank)* | `G@0715` |
| `Price_Approval_Fetch` | *(blank)* | `S!Pl@2026` |
| `Price_Approve_Reject` | *(blank)* | `May@2026` |

The global SAP Connection holds `SARVI_INFO1` + its real password. Get_Plant works only because `G@0715` happens to be `SARVI_INFO1`'s actual password — the resolver fell back to the global username and it matched.

For `Price_Approval_Fetch`, the resolver still falls back to global username `SARVI_INFO1` (per-config username is blank), but uses the per-config password `S!Pl@2026`. That mismatched pair is sent as Basic auth → SAP returns the German "Anmeldung fehlgeschlagen" HTML login page → middleware reports `401 __sap_html_error`.

So the previous `pick()` fix was right for each field in isolation, but credentials are not independent — username and password must come from the same source.

## Fix

Treat the credential pair atomically in the resolver. Per-config row overrides the global pair only when it actually carries a username; otherwise fall through to the global SAP Connection pair entirely (no mixing).

### `src/routes/api/public/middleware/config.ts` (≈ line 130-145)

```ts
const nonEmpty = (v: string | null | undefined) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const perCfgUser = nonEmpty(creds?.username);
const perCfgPass = nonEmpty(creds?.password_encrypted);
const globalUser = nonEmpty(globalRes.data?.sap_username);
const globalPass = nonEmpty(globalSecretRes.data?.sap_password);

// Pair semantics: only use the per-config pair when a username was actually
// entered for this config. A standalone per-config password must NOT be paired
// with the global username (that produces 401 against SAP).
const useOverride = perCfgUser !== null;
const username = useOverride ? perCfgUser : globalUser;
const password = useOverride ? perCfgPass : globalPass;

// ...
credentials: {
  username,
  password,
  extra_headers: creds?.extra_headers ?? {},
},
```

No DB change, no middleware change, no UI change required. Once this ships, both `Price_Approval_Fetch` and `Price_Approve_Reject` will authenticate with the global `SARVI_INFO1` pair (same as `Get_Plant` effectively does) and SAP will return JSON instead of the HTML login page.

## Optional follow-up (only if SAP actually wants different users per API)

If the intent really is a different SAP user per API, the user needs to open each Credentials tab and fill in **both** username and password — saving only a password is what created this trap. We can also harden the save handler in `admin.sap-api.$id.tsx` to reject "password without username" with an inline error.

## Verification

1. After the fix, click **Execute** on Price Approvals with Plant `3801`.
2. Middleware log should show `[/price_approval/Fetch] sap status=200` and a JSON payload (not `__sap_html_error`).
3. `Get_Plant` continues to work.
4. Approve/Reject on Price Approvals (which uses `Price_Approve_Reject`) succeeds with `200`.
