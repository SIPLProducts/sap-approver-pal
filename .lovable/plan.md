## Root cause (confirmed)

The middleware is working. The problem is the `PR_Release_API` row in `sap_api_configs`:

| Config | endpoint_url | method |
|---|---|---|
| **PR_Release_API** (used by Release button) | `/mm_approve_mng/zgp/zgp?sap-client=300` | POST |
| Gate_Pass_Fetch_API | `/mm_approve_mng/zgp/zgp?sap-client=300` | GET |
| PR_Release_Multiple_Fetch_API | `/mm_approve_mng/pr_rel/release?sap-client=300` | PUT |

`PR_Release_API` is pointing at the **Gate Pass** ICF endpoint (`/zgp/zgp`), not the PR release endpoint. That's why SAP replies `{"MESSAGES":[{"TYPE":"E","MESSAGE":"No data entered"}]}` — the gate-pass service doesn't understand a `RELEASE` payload. Postman works because in Postman you are hitting the correct PR release URL directly.

The trace log confirms this: `outbound POST http://10.150.150.154:8103/mm_approve_mng/zgp/zgp` — that URL is coming straight from the config row, not from the middleware or app code.

## Fix

Update the `PR_Release_API` config to the correct SAP ICF path/method used in Postman. Based on the sibling `PR_Release_Multiple_Fetch_API`, the likely correct values are:

- **endpoint_url:** `/mm_approve_mng/pr_rel/release?sap-client=300` (or the full URL the Postman request uses)
- **http_method:** `PUT` (Postman's method — please confirm)

Two ways to apply:

1. **Recommended:** Open **Admin → SAP API → PR_Release_API**, paste the exact URL and method you use in Postman, save.
2. **Or** I can run a migration that sets `endpoint_url` and `http_method` on the `PR_Release_API` row — I just need the exact URL + method from your Postman request (path + `?sap-client=300` is enough; base URL comes from the middleware).

No app or middleware code changes are needed — the earlier PR release response-parsing fixes already handle the array `[{ "MSGTXT": ..., "STATUS": "TRUE" }]` shape.

## What I need from you

Please share (or confirm) the exact **URL** and **HTTP method** of the PR release call in Postman, or approve option 2 with the values above so I can apply the DB update.