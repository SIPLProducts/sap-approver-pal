
# Resustainability SAP MM & SD Approvals PWA — Revised Plan

Based on the two release-strategy sheets you shared, the app must support these exact SAP modules, T-codes, and release flows. Building this in 4 phases so each layer can be validated.

## Modules and SAP T-codes covered

### MM (Materials Management)

| Process | T-code | Max levels | Approvers (in order) |
|---|---|---|---|
| NFA (Note for Approval) | **ZNFA** | up to 8 | F1, F2, F6, M1, M3, M5, MD, S2, S4, T4, T5, T6 (value/category-driven subset) |
| NFA – Territory | **ZNFA_TER** | 1 | T4 |
| PR (Purchase Requisition) | **ME54N / ME55** | up to 8 | IC, M1, M2, M3, T1, T4, T6 |
| PO (Purchase Order) | **ME28 / ME29N** | up to 8 | ZZ, F3, F6, T6, S4 (+ value-driven extras: C1/F1–F5, M1–M5, MD, S2/S3, T4/T5) |
| Service Entry (SR) | **ML81N** | up to 4 | SR, F1, M3, M4 |
| GRN 105 Movement | **MIGO** | 1 | Plant Head or designated user |
| Gate Pass (RGP/NRGP) | **ZGP** | 5 | HOD → Store (sending) → SCM Head → Plant Head → Store receipt |
| Material Issue | **ZMM_REV** | 1 | HOD |
| Gate Entry | **ZMM_GATE** | — | (already implemented externally — read-only view) |

### SD (Sales & Distribution)

**BMW company code**
- Price Approval — `ZBMW_VK11_APP` — single level — Project Head
- Contract Approval L1 — `ZBMW_CONTRACT_APP` — Finance Head / MBD
- Contract Approval L2 — `ZBMW_CONTRACT_APP` — Project Head
- Sales Order Approval L1 — `ZBMW_COCKPIT / ZSD_BMW_SO_APP` — Finance Head / MBD
- Sales Order Approval L2 — `ZBMW_COCKPIT / ZSD_BMW_SO_APP` — Project Head
- Zero Waste Approval — `ZBMW_COCKPIT / ZBMW_SC_ISSUE_PH` — Project Head
- Service Certificate Issue/Download — `ZBMW_COCKPIT / ZBMW_SC_ISSUE_PH` — Project Head

**IWM company code**
- Price Approval — `ZIWM_APPROVE` — single level — Project Head (Approve/Reject/Changes)
- Gate Security — `ZGATE`
- VK11 Condition Creation — MBD Team
- ZV13 Customer Distance — MBD Team
- ZREP_SCR Scrap Price Update — F&A Team

## Phase 1 — Foundation (build first)

**Design system**
- Enterprise look: Resustainability green primary + slate neutrals, white surfaces, dense data tables, accessible AA contrast. Inter + IBM Plex Sans. Mobile-first, installable as PWA.

**Auth & RBAC (Lovable Cloud)**
- Email/password + Google sign-in.
- `profiles` (linked to `auth.users`): sap_user_id, full_name, plant, business_unit (IWM/BMW/Recycling/ISS), company_code, designation.
- `app_role` enum covering every role in your matrices: `F1, F2, F3, F4, F5, F6, M1, M2, M3, M4, M5, MD, S2, S3, S4, T1, T4, T5, T6, IC, ZZ, SR, C1, HOD, PlantHead, SCMHead, StoreHOD, ProjectHead, FinanceHead, MBD, FA, Admin`.
- `user_roles` join table + security-definer `has_role()` (per Lovable user-roles best practice).
- Plant + BU scoping so a Plant Head only sees their plant's documents.

**Approval engine (data-driven, not hard-coded)**
- `approval_strategies` — one row per (module, t_code, doc_type, BU/company_code) with the ordered list of role steps and value/category conditions.
- `approval_documents` — synced from SAP: doc_type, sap_doc_no, sap_t_code, plant, BU, requester, total_value, currency, current_step, overall_status.
- `approval_steps` — per-document materialized chain: sequence, role, assigned_user, status (pending/approved/rejected/skipped), decided_at, comments.
- `approval_attachments`, `approval_line_items`, `audit_log`, `notifications`.
- Conditions engine for value/category rules (NFA and PO have value-driven extra levels per your sheet's "Rarely used" columns).
- RLS: a user sees a document if (a) they are the current pending approver, (b) they previously acted on it, (c) they raised it, or (d) they have `Admin`.

**Core screens**
- `/login`
- `/inbox` — pending approvals for me; filters by module (MM/SD), T-code, BU, plant, value band, age. Bulk approve where policy allows.
- `/approval/$id` — header + line items + attachments + approval trail + Approve / Reject / Send-back / Forward / Request-info with mandatory comment on reject/send-back.
- `/history` — everything I've touched.
- `/admin/users`, `/admin/roles`, `/admin/strategies` — edit role-step matrices without redeploy.
- `/settings/notifications` — per-channel preferences.

**SAP integration layer (mocked in Phase 1, real in Phase 2)**
- `src/lib/sap/*.functions.ts` server functions, one per T-code group: `fetchOpenZNFA`, `fetchOpenPR`, `fetchOpenPO`, `fetchOpenSR`, `fetchBMWSO`, `fetchIWMPrice`, etc.
- Mock data in Phase 1 mirrors real OData shape so swapping in Phase 2 is drop-in.

## Phase 2 — Real SAP connectivity

- Server-side OData/REST client (TanStack `createServerFn`, runs on Cloudflare Workers — pure fetch, no Node-only SDKs).
- One adapter per T-code group calling the corresponding SAP Gateway / Z-service endpoint. The Z transactions (`ZNFA`, `ZGP`, `ZBMW_COCKPIT`, etc.) are custom — your SAP team will expose them as OData/REST services.
- CSRF token + Basic Auth (or OAuth2) configurable per environment.
- Sync: scheduled poll every 2–5 min upserts open docs into our DB; on-demand "Refresh" pulls instantly.
- Posting decisions writes back to SAP via the matching release endpoint and records audit.
- Retry queue for failed posts; SAP errors mapped to user-friendly messages.

**Secrets I'll need (you add them in a secure form, never in chat):**
`SAP_BASE_URL`, `SAP_CLIENT`, `SAP_AUTH_MODE` (basic|oauth), `SAP_USERNAME` + `SAP_PASSWORD`, **or** `SAP_OAUTH_CLIENT_ID`/`SECRET`/`TOKEN_URL`.

**What I'll need from your SAP team:**
1. SAP Gateway base URL and client number.
2. Confirmation that the standard services for PR/PO/Service Entry are activated, or your published OData/REST paths for each Z-T-code (`ZNFA`, `ZNFA_TER`, `ZGP`, `ZMM_REV`, `ZBMW_VK11_APP`, `ZBMW_CONTRACT_APP`, `ZBMW_COCKPIT`, `ZSD_BMW_SO_APP`, `ZBMW_SC_ISSUE_PH`, `ZIWM_APPROVE`, `ZGATE`, `ZV13`, `ZREP_SCR`).
3. Egress IP whitelisting for our app.

## Phase 3 — Notifications (in-app + web push + email)

- **In-app realtime:** Supabase Realtime on `notifications` → toast + bell badge + auto-refresh inbox.
- **Web Push (PWA):** service worker + VAPID, `push_subscriptions` table per user/device. iOS works once installed to home screen.
- **Email:** Resend connector — instant alert on new assignment, plus daily digest of items pending > 24 h.
- Per-user preferences for which channels fire for which modules/T-codes.
- Escalation rule: if a step is pending > N hours, notify next-up approver and Admin.

## Phase 4 — PWA polish & hardening

- Manifest, app icons, install prompt, offline-cached inbox.
- Pagination + virtualized lists for big inboxes.
- Excel export of approval history (full audit trail).
- RLS test pack, signed webhook for SAP callbacks, rate-limited posting endpoints.

## What I want to confirm before I start Phase 1

1. Is the role list above complete, or should I add any role (e.g. C1 only appears as a value-driven extra for PO — should it be a first-class role)?
2. For NFA / PO value bands ("Rarely used" columns C1/F1–F5/M1–M5/MD/S2/S3/T4/T5), do you have a value/category → required-approvers table I can encode now, or should I ship the matrix editor in `/admin/strategies` and your business team fills it in?
3. `ZMM_GATE` — you noted "Already worked on it." Should I include a read-only view of gate entries, or skip entirely?
4. Single language (English) v1, or English + Hindi from day one?

Approve this plan and I'll enable Lovable Cloud and start building Phase 1.
