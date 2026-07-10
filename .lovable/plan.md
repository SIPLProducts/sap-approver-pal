## Goal

Stop hardcoding "User ID" / "Temporary Password" (and the fixed `zuser` + `zpassword` picks) in the forgot-password email. Instead, drive the email body directly from whatever fields the SAP `Forgot_API` response returns for that user, so if SAP later adds/renames/removes columns the email adapts automatically.

Example SAP response the email must render as-is:
```
[
  { "ZUSER": "...", "ZPASSWORD": "...", "ZSTATUS": "..." }
]
```

## Changes

### 1. `src/lib/auth/sap-forgot.functions.ts`

- **Unwrap the SAP record generically.** After extracting `inner` from the middleware envelope, pick the first plain object in the payload (walk arrays, take `inner[0]` when array, else `inner` when object). Do not look for specific keys.
- **Build a `fields` array** of `{ key, label, value }` from every own-property of that record whose value is a non-empty scalar (string/number/boolean). Preserve SAP's original key order.
  - `label` = key with a leading `Z` stripped, snake/underscore split, Title Cased (e.g. `ZUSER` → `User`, `ZPASSWORD` → `Password`, `ZSTATUS` → `Status`, `FIRST_NAME` → `First Name`). No renaming beyond that.
  - `value` = string form of the SAP value, unmasked.
- **Recipient email discovery stays generic:** pick the first field whose key matches `/mail|email/i` and whose value looks like an email; otherwise fall back to `data.email` (the address the user typed). No hardcoded `ZMAIL` list.
- **Success gate** becomes "response is not rejected AND at least one non-email field has a value" instead of requiring `zuser && zpassword`.
- **Debug log** prints the list of keys returned plus lengths (never full password values), e.g. `[sap-forgot] fields=ZUSER,ZPASSWORD,ZSTATUS; ZPASSWORD.len=10`.
- **Missing-data error** wording: "SAP did not return any account details for this email."
- Replace the call `buildCredentialsEmail({ zuser, zpassword })` with `buildCredentialsEmail({ fields, recipient })`.

### 2. Email template in the same file

Rewrite `buildCredentialsEmail` so it takes `{ fields, recipient }` and renders:

- Header block: brand logo + "Re Sustainability / RESL Approvals" (unchanged).
- **Highlight card at top:** show the first field's value as the display name (or fall back to recipient), no hardcoded "ID:" line.
- **Details table:** one row per entry in `fields`, in SAP's order:
  - Left column = `label`
  - Right column = value, rendered with the same per-character `<span>` trick already used for the password (prevents Gmail/Outlook from masking it), applied to every value so nothing looks like a password field.
- Footer: unchanged reminder to sign in and change password after login.
- Plain-text alternative: `label: value` lines in the same order, followed by the existing sign-in reminder.

No field is special-cased. If SAP returns only `ZUSER` + `ZPASSWORD`, only those two rows appear. If SAP later adds `ZEMAIL`, `ZROLE`, etc., they show up automatically without another code change.

### 3. No other files change

- Middleware, request payload (`{ zmail }`), SMTP config, subject line, logging table, and route wiring stay exactly as they are.

## Verification

1. Trigger forgot password with a real SAP account.
2. Check the delivered email — rows must match the SAP response keys/values 1:1 (labels prettified from the SAP keys), and the password value must be the literal string SAP returned (not asterisks).
3. Server log line `[sap-forgot] fields=...` should list every key SAP returned.
