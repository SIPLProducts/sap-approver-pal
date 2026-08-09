# Login logo + ZNFA Preview verification

## 1. Login page — uploaded "re Sustainability" logo top-left

Current state (verified): `src/routes/login.tsx` already shows a logo chip at the
top-left of the hero panel, rendered by `BrandLogo`, which points at the older
`resl-logo.png` asset.

Change:
- Register the uploaded image as a CDN asset pointer (`src/assets/re-sustainability-logo.png.asset.json`).
- Point the login top-left chip at that new logo (keep the same chip size/placement,
  white rounded card, `h-7`), and use it for the mobile logo block too so both match.
- Also use it as the favicon (`public/favicon.png`, square padded) and reference it
  from `src/routes/__root.tsx`, since it is the brand mark.

No layout, copy or auth-flow changes on the login page.

## 2. ZNFA Preview — already wired, verify only

Verified in the current code:
- The document toolbar renders **Preview** on all three paths (Release, Display,
  Approved List) — it sits outside the `showDocActions` gate.
- `onDocPreview` calls the `fetchZnfaPrint` server function, which loads the
  `ZNFA_PRINT_API` config from SAP API Settings and posts exactly:
  `{ TYPE_NFA, ZRFQS: [{ RFQ: "" }], GET: "", REL_CODE, ZNFA_NUM, PRINT: "X" }`.
- The Base64 response is normalised, converted to a Blob URL in the browser and
  rendered in the preview dialog (iframe for PDF, `<img>` for image MIME types),
  with Open-in-new-tab and Download actions, and SAP `MSG` shown on failure.

So no code change is required here. If Preview is failing on your server, the cause
is configuration/runtime rather than the screen: the plan's follow-up step is to
check the `ZNFA_PRINT_API` row is active and its endpoint/method are correct, and
read `sap_api_sync_log` entries prefixed `znfa-print:` for the exact SAP reply.

## Technical notes

- Files touched: `src/routes/login.tsx`, `src/components/brand-logo.tsx` (asset
  import only), new asset pointer JSON, `public/favicon.png`, `src/routes/__root.tsx`.
- `src/lib/mm/znfa-print.functions.ts` and `mm.znfa-release.tsx` stay unchanged.
