Replace the current stylized illustrations on the login page's left panel with 2–3 high-quality, realistic photographs that reflect business approvals, workflow, logistics, and digital operations, while keeping the existing dark red/gold executive theme intact.

## What changes

- Left panel of `src/routes/login.tsx` (the hero column). Header logo, footer strip, and the right-hand sign-in form stay exactly as they are.
- The current 3 AI-illustrated images (`login-approvals-1/2/3.jpg`) are replaced with new realistic photographic assets.

## Image direction (realistic, photographic, on-theme)

Three images, each generated at premium quality to avoid the illustrated/cartoon look:

1. Executive at a laptop reviewing/signing a digital approval — warm office lighting, shallow depth of field, subtle red/gold rim light, no fake UI text on screen.
2. Logistics / operations detail — a supervisor with a tablet in a clean warehouse or plant environment (ties to SAP MM/SD approvals: gate pass, material reservation, sales orders).
3. Close-up hands on keyboard with a subtle checkmark / secure-workflow motif, dark navy backdrop with red-gold accent light.

All three: photorealistic, no visible garbled text, dark tonal palette that blends with the existing `bg-gradient-exec` panel and gold/red brand accents. Each image will be generated with the `premium` tier and uploaded via `lovable-assets` (replacing the existing asset pointers so file paths stay stable).

## Layout

Keep the existing collage grid on the left panel (large feature image + two stacked secondary images), tuned so nothing is cropped awkwardly at common laptop sizes:

```text
+-----------------------------+-------------------+
|                             |   image 2         |
|      image 1 (feature)      +-------------------+
|                             |   image 3         |
+-----------------------------+-------------------+
```

- Rounded corners, subtle white ring, soft shadow — unchanged.
- Slight top-to-bottom dark gradient over the feature image so the "Secure SAP Approvals" pill and heading stay legible.
- Existing "Approve with confidence." heading and footer line (SSO · MFA · SAP-certified + copyright) are preserved. No marketing bullets are re-added.

## Technical details

- Files touched: `src/routes/login.tsx` only (image swap + minor class tweaks for the gradient overlay).
- Asset pointers touched: `src/assets/login-approvals-1.jpg.asset.json`, `…-2.jpg.asset.json`, `…-3.jpg.asset.json` are regenerated via `lovable-assets create` so the CDN URLs point at the new realistic photos.
- No routing, auth, server-function, or business-logic changes.
- QA: after generation, each image is visually inspected (no garbled text, on-theme, correct crop) before wiring in. Then a build check to confirm the login route still compiles.
