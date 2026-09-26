# VerifyMet — PDR (Prototype Only)
SIH 2026 · SIH26036 · Ministry of Consumer Affairs, DoCA
Problem: Online Verification System for Weighing & Measuring Instruments

## 1. Goal
Prototype one instrument's complete journey: `Owner applies → Officer verifies → Certificate + QR`.
Example instrument: Weighing Machine `WM-1024`, Delhi. Valid until 15 Nov 2026.

Source: https://sih.gov.in/sih2026PS (SIH26036)

## 2. Scope
In:
- Firebase Auth (email/password only) + role from D1 `User` table
- Owner dashboard + Apply form + Tracking bar
- Officer queue + Field verification form (Pass/Fail)
- Auto digital certificate + public QR verify page

Out (don't prototype): payments, SMS alerts, real GPS stamping, analytics dashboards, multilingual, offline sync, audit logs, OAuth/social login, custom claims.

## 3. Prototype Flow (6 screens for PPT)
`Login → Owner Dashboard → Apply → Officer Verification → Digital Certificate → QR Verification`

Pipeline underneath: `Apply → Schedule → Inspect → Verify → Certify → Track`

1. **Login** — Firebase email/password. Role read from D1 after `POST /api/me/sync`. Seed: `owner@demo.in / Owner123!`, `lmo@demo.in / Lmo123!`, `gatc@demo.in / Gatc123!`, `admin@demo.in / Admin123!`.
2. **Owner Dashboard** — list of instruments, status, expiry. CTA: Apply for Verification.
   - e.g. `WM-1024 | Weighing Machine | Verification Due | Valid Until: 15 Nov 2026`
3. **Apply for Verification** — fields: instrumentType, manufacturer, model/serial, capacity, location, lastVerificationDate, photo upload. Submit → status `Submitted`, ID `VM-1024`.
4. **Officer Dashboard (LMO/GATC)** — table: Application / Instrument / Location / Status. Actions: Schedule, Start Verification.
   - e.g. `VM-1024 | Weighing Machine | Delhi | Pending`
5. **Field Verification** — shows instrument details, observedMeasurement, permissibleTolerance, auto test result, photo upload, remarks. Buttons: `PASS — Verify` / Fail.
6. **Digital Certificate + QR Verify** — certificate no `VM-2024-1024`, dates, officer, QR → public route `/verify/:certNo` shows `✓ VALID | WM-1024 | Valid until 15 Nov 2026`.

Status bar (tracking): `Submitted → Scheduled → Inspection → Verified → Certificate Issued`.

## 4. Data Model (minimal, 4 tables)
```ts
User { firebaseUid, email, role: Owner|LMO|GATC|Admin }
Instrument { id: "WM-1024", ownerId /* = firebaseUid */, type, manufacturer, serial, capacity, location, validUntil, status }
Application { id: "VM-1024", instrumentId, status: Submitted|Scheduled|Inspection|Verified|Certified, observedValue?, tolerance?, photos[] /* Cloudinary secure_urls */, remarks?, officerId? }
Certificate { certNo, applicationId, instrumentId, verifyDate, validUntil, officerId, qrUrl }
```

## 5. API (Hono, ~8 routes)
```
POST /api/me/sync             → upsert User from verified Firebase token (default role Owner)
POST /api/applications        → create (Submitted)
GET  /api/applications/:id    → tracking + status bar
GET  /api/officer/queue       → list Pending/Scheduled
POST /api/applications/:id/schedule
POST /api/applications/:id/verify { observed, tolerance, result: PASS|FAIL, remarks, photos }
GET  /api/certificates/:certNo → cert data
GET  /verify/:certNo           → public QR page (no auth)
```
Auth: `Authorization: Bearer <Firebase ID token>` on all `/api/*` except `/verify`. Hono middleware verifies via JWKS (`jose`), attaches `uid`.

## 6. Tech Stack + Deploy
- **Frontend:** Vite React + Tailwind (v4, `@tailwindcss/vite`), theme tokens from `DESIGN.md` (ClickHouse black `#0a0a0a` + yellow `#faff69`). Deployed on **Vercel**. QR: `qrcode.react`. Public route `/verify/:certNo`. Auth: `firebase` SDK (email/password only).
- **Backend:** **Hono** on **Cloudflare Workers**. DB: **Turso** (libSQL, `@libsql/client/web`; schema in `migrations/*.sql`, applied via `turso db shell`; memory fallback when unconfigured). Auth verify: `jose` JWKS against Google securetoken. Files: **Cloudinary** — frontend unsigned upload, backend stores `secure_url` only.
- **Seed:** 4 Firebase users (owner/lmo/gatc/admin) + 2 instruments + 1 application so demo works without setup.
- **Env keys:** `VITE_API_URL`, `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`, `VITE_CLOUDINARY_CLOUD`, `VITE_CLOUDINARY_PRESET`, backend `FIREBASE_PROJECT_ID`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (local: `backend/.dev.vars`; deploy: `wrangler secret put …`). Empty Firebase/Cloudinary/Turso values → demo fallback mode (memory store).

## 7. Demo Script (60 sec)
Login as Owner → Apply WM-1024 → tracking shows Submitted → login as LMO → Schedule → Start Verification → enter observed vs tolerance → PASS → certificate auto-generates → scan QR → VALID page.

## 8. Done Criteria
All 6 screens clickable with seeded WM-1024, QR scan resolves to VALID, deploys live (Vercel URL + workers.dev URL) for PPT.
