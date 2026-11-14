# OfficePulse — Complete Architecture

**Product:** OfficePulse Attendance  
**Codebase:** `attendance-app/`  
**Live (typical):** Cloudflare Worker `office-pulse` + Supabase project  

This document describes the full system architecture: runtime, data, auth, punch validation, admin flows, PWA, and deployment.

---

## 1. Purpose

OfficePulse is a **mobile-first office attendance** system for a small office. Employees check in and out only when they are:

1. Authenticated and **ACTIVE**
2. Either on **office Wi‑Fi** (public IP match) **or** physically at a configured **office / branch location** (GPS geofence)
3. Subject to **server-side** validation (the browser is never trusted alone)

Admins manage employees, shifts, office settings/locations, attendance corrections, Excel reports, and audit history.

---

## 2. High-level architecture

```text
┌─────────────────┐     HTTPS      ┌──────────────────────────────┐
│  Phone / PC     │ ─────────────► │  Cloudflare Workers          │
│  Safari/Chrome  │ ◄───────────── │  OpenNext (Next.js App)      │
│  PWA optional   │                │  Middleware + API routes     │
└────────┬────────┘                └──────────────┬───────────────┘
         │ GPS (device)                            │
         │                                         │ Supabase JS
         │                                         ▼
         │                              ┌──────────────────────┐
         │                              │  Supabase            │
         │                              │  • Auth (email/pw)   │
         │                              │  • PostgreSQL + RLS  │
         │                              │  • Service role ops  │
         │                              └──────────────────────┘
         ▼
   Browser Geolocation API
   (client hint only; server re-checks)
```

| Layer | Technology |
|--------|------------|
| UI | Next.js 16 App Router, React 19, Tailwind CSS 4 |
| API | Next.js Route Handlers (`app/api/**`) |
| Auth / DB | Supabase Auth + PostgreSQL + Row Level Security |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Maps (admin) | Leaflet + OpenStreetMap tiles (no Google API key) |
| Reports | SheetJS (`xlsx`) Excel export |
| Install | Progressive Web App (manifest + light service worker) |

---

## 3. Repository layout

```text
attendance-app/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout, PWA meta, fonts, SW register
│   ├── manifest.ts           # Web app manifest
│   ├── page.tsx              # Role-based redirect
│   ├── login/                # Sign-in
│   ├── change-password/      # Forced / voluntary password change
│   ├── dashboard/            # Employee punch home
│   ├── attendance/           # Employee history
│   ├── profile/              # Employee profile
│   ├── admin/                # Admin UI (dashboard, employees, …)
│   └── api/                  # HTTP APIs
├── components/               # UI + forms + PWA
├── lib/                      # Domain logic (auth, attendance, GPS, IP)
├── validations/              # Zod schemas
├── types/                    # Shared TypeScript types
├── supabase/                 # schema.sql + incremental migrations
├── public/                   # icons, brand, sw.js
├── scripts/                  # bootstrap-admin, icon generators
├── wrangler.jsonc            # Cloudflare Worker config (public vars)
├── open-next.config.ts       # OpenNext Cloudflare adapter
├── USER_GUIDE.md             # End-user / admin manual
├── CLOUDFLARE.md             # Deploy env checklist
└── ARCHITECTURE.md           # This file
```

---

## 4. Runtime & request flow

### 4.1 Middleware (`middleware.ts` → `lib/supabase/middleware.ts`)

Every matched request:

1. Creates a Supabase SSR client from cookies
2. Calls `auth.getUser()` to refresh/validate session
3. Redirects unauthenticated users to `/login` except for public paths:
   - `/`, `/login`
   - `/manifest.webmanifest`, `/sw.js`
   - `/icons/**`, `/brand/**`
   - `/api/auth/**`
4. Redirects authenticated users away from `/login` toward `/dashboard` (or admin home via page logic)

Static assets (png/svg/…) are excluded from the matcher so PWA install is not blocked.

### 4.2 Page routing (conceptual)

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Any authed | Redirect ADMIN / ADMIN_VIEWER → admin dashboard; else employee dashboard |
| `/login` | Public | Email + password |
| `/change-password` | Authed | First login / reset forced change |
| `/dashboard` | Employee (+ admin “My Punch”) | Check-in / check-out card |
| `/attendance` | Employee | Own history |
| `/admin/**` | ADMIN / ADMIN_VIEWER | Management UI (writes: ADMIN only) |

### 4.3 Env injection

- **Server / Worker:** `NEXT_PUBLIC_SUPABASE_URL`, publishable key, `SUPABASE_SECRET_KEY` (secret)
- **Browser:** `PublicEnvScript` injects `window.__OFFICE_PULSE_ENV__` so client Supabase works when Cloudflare only sets runtime vars

---

## 5. Authentication & roles

### 5.1 Identity model

- **Supabase Auth user** = login identity (`email` + password)
- **`employees` row** = app profile, linked by `auth_user_id`
- Login email lives in **Auth**, not as a required column on `employees` (edit UI looks it up via service role)

### 5.2 Roles (`lib/auth/roles.ts`)

| Role | Access |
|------|--------|
| `EMPLOYEE` | Punch + own history/profile |
| `ADMIN_VIEWER` | Read-only admin area (dashboards, reports, audit) |
| `ADMIN` | Full write: employees, settings, shifts, corrections, deletes |

Helpers:

- `isAdminStaff` → ADMIN or ADMIN_VIEWER  
- `canWriteAdmin` → ADMIN only  

### 5.3 Session helpers (`lib/auth/session.ts`)

- `getCurrentEmployee()` — joins Auth user → `employees` (+ shift)
- `requireAdmin()` — active ADMIN (used by mutating APIs)
- Password gate: `must_change_password` forces `/change-password`

### 5.4 Privileged operations (service role)

`createServiceClient()` uses `SUPABASE_SECRET_KEY` for:

- Creating Auth users (employee create)
- Password reset / delete Auth user
- Looking up Auth email for admin UI
- Hard-delete cascades when RLS/FK needs privilege

Never expose this key to the browser.

### 5.5 Employee lifecycle

```text
Create → Auth user + employees row (must_change_password=true)
       → share email + temp password
Login  → if must_change_password → change password API clears flag
Reset  → admin sets new temp password + must_change_password
Deactivate → status=INACTIVE (blocks login)
Activate   → status=ACTIVE
Delete     → attendance removed, employee row + Auth user deleted
```

---

## 6. Data model (PostgreSQL)

Canonical definition: `supabase/schema.sql`  
Incremental: `supabase/migration_*.sql`

### 6.1 Entity relationship

```text
shifts 1───* employees *───1 auth.users
                │
                │ 1
                ▼
           attendance  (unique employee_id + attendance_date)

office_settings  (singleton-ish org config: IP, timezone, GPS accuracy, wifi-only flag)
office_locations *  (branch geofences: lat/lng/radius)

employees (admin) ──► audit_logs
```

### 6.2 Core tables

**`shifts`** — name, start/end time, grace minutes, ACTIVE/INACTIVE  

**`employees`** — `employee_id` (e.g. EMP002), name, mobile, designation, role, status, `must_change_password`, `auth_user_id`  

**`office_settings`** — org name, legacy pin, **office public IP(s)**, max GPS accuracy, `allow_wifi_only_punch`, timezone  

**`office_locations`** — named branches with lat/lng/radius (multi-site geofencing)  

**`attendance`** — daily open/closed record; check-in/out times, GPS, IP, distance, late/early flags, optional `*_location_name`  

**`audit_logs`** — admin actions (create/update/delete/correct/reset/settings)  

### 6.3 Security (RLS)

- Enabled on all app tables  
- `is_admin()` / `is_admin_staff()` security-definer helpers  
- Employees read/update **own** attendance; admins broader  
- Only ADMIN inserts audit / mutates settings & employees  

---

## 7. Punch validation architecture

**Source of truth:** `lib/attendance/validate.ts`  
**Used by:** `POST /api/attendance/check-in`, `POST /api/attendance/check-out`  

### 7.1 Hybrid rules

```text
                    ┌─────────────────────┐
                    │ Client sends GPS    │
                    │ (optional payload)  │
                    └─────────┬───────────┘
                              ▼
              Server reads cf-connecting-ip / forwarded IP
                              ▼
         ┌────────────────────────────────────────┐
         │ Active office_locations configured?    │
         └────────────────┬───────────────────────┘
                          │ no → OFFICE_NOT_CONFIGURED
                          ▼
         GPS present + accuracy OK + inside a branch radius?
                          │
              ┌───────────┴───────────┐
              │ yes                   │ no
              ▼                       ▼
         ACCEPT (store GPS,     On office public IP
         location name)         AND allow_wifi_only_punch?
                                      │
                           ┌──────────┴──────────┐
                           │ yes                 │ no
                           ▼                     ▼
                      ACCEPT (Wi‑Fi only)   GPS_REQUIRED /
                                            GPS_ACCURACY_TOO_LOW /
                                            OUTSIDE_OFFICE
```

**Important:** Office Wi‑Fi is detected via **public IP**, not SSID (browsers cannot read Wi‑Fi name).

### 7.2 Supporting modules

| Module | Role |
|--------|------|
| `lib/network/ip.ts` | Normalize IP; prefer `cf-connecting-ip`; allow-list match |
| `lib/location/haversine.ts` | Distance in meters |
| `lib/location/match-office.ts` | Nearest active location within radius + accuracy |
| `lib/location/live-gps.ts` | Client watch/getCurrentPosition; reject coarse PC IP location |
| `lib/attendance/timezone.ts` | “Today” in office TZ; late / early leave; work minutes |
| `lib/attendance/network-error.ts` | Human messages (incl. Safari Private Relay tip) |

### 7.3 Client punch UI (`AttendanceCard`)

1. Refresh office settings + today’s attendance  
2. Refresh public IP vs office allow-list  
3. Acquire GPS (on iPhone: after user tap — Safari gesture requirement)  
4. Enable CHECK IN / OUT when rules satisfied  
5. Confirm dialog for check-out (early vs normal)  
6. POST to API; server re-validates  

### 7.4 Late / early

- **Late:** check-in after shift start + grace  
- **Early leave:** check-out before shift end  
- Flags stored on `attendance`; shown in UI and Excel  

---

## 8. API surface

### 8.1 Auth / account

| Method | Path | Notes |
|--------|------|--------|
| — | `/api/auth/callback` | Supabase OAuth/code exchange (if used) |
| POST | `/api/account/change-password` | Re-auth + update password; clear `must_change_password` |

### 8.2 Employee attendance

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/attendance/today` | Today’s row + office (+ locations); `Cache-Control: no-store` |
| GET | `/api/attendance/history` | Own history |
| POST | `/api/attendance/check-in` | Validates + inserts/updates OPEN |
| POST | `/api/attendance/check-out` | Validates + closes with minutes / early flag |
| GET | `/api/network/my-ip` | Current public IP + match status for UI |

### 8.3 Admin

| Area | Paths |
|------|--------|
| Employees | `GET/POST /api/admin/employees`, `GET/PATCH/DELETE …/[id]`, activate, deactivate, reset-password, next-id |
| Settings | `GET/PATCH /api/admin/settings` (incl. locations) |
| Shifts | `GET/POST /api/admin/shifts`, `PATCH/DELETE …/[id]` |
| Attendance | list, correct, Excel export |
| Audit | `GET /api/admin/audit-logs` |

Mutating admin routes require **ADMIN**. View APIs typically allow **ADMIN_VIEWER**.

---

## 9. Admin feature architecture

| Feature | Behavior |
|---------|----------|
| Employees | Auto EMP IDs, temp passwords, edit, activate/deactivate, themed delete confirm (`DELETE`), reset shows **email + password** |
| Settings | Public IP (“Use my current IP”), OpenStreetMap pin editor, multi **office locations**, wifi-only toggle, accuracy/radius/timezone |
| Shifts | CRUD ACTIVE shifts |
| Attendance | Day filter, correct times with required reason → audit |
| Reports | Month list + Excel with late/on-time/early columns |
| Audit | Chronological admin actions |

Map stack: Leaflet dynamically imported (`ssr: false`) + OSM tiles.

---

## 10. Frontend architecture

- **Server Components** for most pages (data fetch with cookie Supabase client)  
- **Client Components** for forms, punch card, maps, dialogs, PWA  
- Shared UI: `Button`, `Card`, `Input`, `Label`, `ConfirmDialog`, `DateFilters`  
- Branding: DM Sans + Source Serif, teal accent, `public/brand/logo.png`  

### PWA

| Piece | Role |
|-------|------|
| `app/manifest.ts` | `standalone`, `start_url: "/"`, icons |
| `public/sw.js` | Installability + static brand/icon cache only (**no HTML/API cache**) |
| `InstallPrompt` | Android `beforeinstallprompt`; iOS Share → Add to Home Screen; non-Safari iOS warning |
| Apple meta | `apple-mobile-web-app-*`, apple-touch-icon |

iOS notes (product constraints, not bugs alone):

- No native Install button — Safari Share only  
- GPS often needs a user gesture  
- **iCloud Private Relay** changes public IP → Wi‑Fi check fails until disabled for the site  

---

## 11. Deployment architecture

```text
GitHub main ──► Cloudflare Workers Builds ──► OpenNext build ──► Worker + Assets
                      │
                      ├── Build vars: NEXT_PUBLIC_*
                      └── Runtime secret: SUPABASE_SECRET_KEY
```

| Artifact | Purpose |
|----------|---------|
| `wrangler.jsonc` | Worker name, compatibility, public `vars`, assets binding |
| `npm run deploy` | `opennextjs-cloudflare build && deploy` |
| Supabase Auth URLs | Site URL + `/api/auth/callback` must match Worker URL |

See `CLOUDFLARE.md` for common misconfiguration (secret paste with `NAME=`, localhost APP_URL, missing build vars).

---

## 12. Security model (summary)

| Control | Implementation |
|---------|----------------|
| Transport | HTTPS (Workers) |
| Auth | Supabase email/password; session cookies via `@supabase/ssr` |
| Authorization | Role checks in session helpers + RLS |
| Punch trust | Server IP + GPS validation; client UI is advisory |
| Secrets | Service role only on server/Worker secret store |
| Audit | Admin mutations logged |
| Soft vs hard delete | Deactivate preferred; delete removes attendance + Auth |

---

## 13. Operational runbooks (architecture view)

### New environment

1. Create Supabase project; run `schema.sql` (+ any pending migrations)  
2. Configure Auth URL for Worker domain  
3. Set Cloudflare vars/secrets; deploy  
4. `npm run bootstrap-admin` (or seed) for first ADMIN  
5. Admin Settings: set public IP on office Wi‑Fi; add location pin(s) on map  

### Migrations present

| File | Adds |
|------|------|
| `migration_must_change_password.sql` | Forced password change flag |
| `migration_late_early.sql` | `is_late` / `is_early_leave` |
| `migration_wifi_only_punch.sql` | Wi‑Fi-only punch option |
| `migration_admin_viewer.sql` | `ADMIN_VIEWER` role |
| `migration_office_locations.sql` | Multi-branch locations + attendance location names |
| `migration_employee_delete_policy.sql` | Admin DELETE RLS on employees |

---

## 14. Error codes (`ApiErrorCode`)

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` / `FORBIDDEN` | Auth / role |
| `EMPLOYEE_INACTIVE` | Deactivated account |
| `OFFICE_NOT_CONFIGURED` | No locations / missing setup |
| `OFFICE_NETWORK_REQUIRED` | Public IP not in allow-list (when required path) |
| `GPS_REQUIRED` / `GPS_ACCURACY_TOO_LOW` / `OUTSIDE_OFFICE` | Location path failed |
| `ALREADY_CHECKED_IN` / `ALREADY_CHECKED_OUT` / `NOT_CHECKED_IN` | State machine |
| `VALIDATION_ERROR` / `SERVER_ERROR` | Input / unexpected |

---

## 15. Identity gate (session state machine)

Middleware (`lib/supabase/middleware.ts`) is the **central identity gate** after Auth:

1. No user → allow public assets / login; else redirect `/login`
2. User but missing or **INACTIVE** employee → `signOut` + `/login`
3. **must_change_password** → only `/change-password` (+ change-password API); pages redirect, other APIs `403`
4. `/login` or `/` while authed → role home (`adminHomePath`) or forced password change

Punch APIs also reject inactive / forced-password. Deactivate relies on the middleware gate to clear the next request.

Attendance **status**: check-out sets `CLOSED`, but keeps `CORRECTED` if an admin already corrected the day. Admin **correct** recomputes `is_late` / `is_early_leave`.

## 16. Design principles

1. **Server is authoritative** for punch acceptance  
2. **Public IP ≈ office Wi‑Fi**; GPS ≈ physical presence at a branch  
3. **Hybrid mode** supports laptop desks (Wi‑Fi) and field/branches (GPS)  
4. **PWA must not cache HTML/API** (stale settings bug)  
5. **Least privilege:** viewers read; only ADMIN writes; service role narrowly used  
6. **Mobile-first**, with explicit Safari / Private Relay / location UX  
7. **One identity gate** — session validity is not “has Auth cookie?” alone 

---

## 17. Related docs

| Doc | Audience |
|-----|----------|
| `USER_GUIDE.md` | Admins & employees — how to use |
| `CLOUDFLARE.md` | Deploy / env troubleshooting |
| `README.md` | Quick start & stack |
| `AGENTS.md` | Notes for AI/coding agents (Next.js version caveats) |

---

*Generated for the OfficePulse codebase. Update this file when validation rules, roles, or deploy topology change.*
