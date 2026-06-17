## Root cause

SAP returns HTTP 200 with a JSON body that contains empty values like
`"ADV_DOC_NUM": { "ZEILE": , "EBELP": }`. That is not valid JSON, so
`await res.json()` throws and the middleware's `.catch(() => null)` swallows
it, leaving `data = null`. Postman shows the raw text, which is why it
"works" there.

## Fix — `middleware/server.js`

Make `invokeSapRaw` (and `invokeSap`) parse the body as text first, then:

1. Try `JSON.parse(text)`.
2. If that throws, sanitize the SAP-specific malformed pattern and retry:
   - replace empty object/array values: `: ,` → `: null,` and `: }` → `: null}` and `: ]` → `: null]`
   - then `JSON.parse` again.
3. If parse still fails, return `{ raw: text, parse_error: err.message }` as
   `data` so the app sees what SAP actually sent instead of `null`.

Concretely, factor a small helper:

```js
function safeParseSapJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const sanitized = text
    .replace(/:\s*,/g, ": null,")
    .replace(/:\s*\}/g, ": null}")
    .replace(/:\s*\]/g, ": null]");
  try { return JSON.parse(sanitized); } catch (e) {
    return { __parse_error: e.message, __raw_preview: text.slice(0, 500) };
  }
}
```

Use it in both `invokeSap` and `invokeSapRaw` instead of `res.json()`. Also
log a short preview of the raw text in `[raw-invoke]` so future malformed
payloads are visible immediately.

User must redeploy / restart the middleware after this change.

## Fix — `src/lib/sd/sc-so-approval.functions.ts`

No real logic change needed. The server fn already handles `sapJson?.DATA`.
After the middleware fix, `data` will be the real object with `DATA: [...]`
and rows will populate.

Optional: when `data?.__parse_error` is present, surface it as the `error`
field on the response so the UI shows "SAP returned unparseable JSON: …"
instead of silently "0 records".

## Out of scope

- No UI / table / column changes.
- No SAP API config or request-field changes.
- The SAP backend bug (emitting `: ,`) is not something we can fix here;
  we just stop dropping the response because of it.

## Verification

1. Restart middleware.
2. Click **Execute** on the screen.
3. `[raw-invoke]` log now shows the real SAP body preview.
4. Table populates with rows from SAP.
