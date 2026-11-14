# OfficePulse — Security Threat Model

**Product:** OfficePulse Attendance  
**Date:** 2026-11-14  
**Related:** `SECURITY_FINDINGS.md`, `ARCHITECTURE.md`

---

## 1. Assets

| Asset | Sensitivity | Location |
|-------|-------------|----------|
| Employee PII (name, mobile, email, designation) | High | `employees`, Auth |
| Attendance records (time, GPS, IP) | High | `attendance` |
| Office geofences + public IP allow-list | Medium | `office_settings`, `office_locations` |
| Admin audit trail | Medium | `audit_logs` |
| Supabase secret / service role key | Critical | Cloudflare Secret only |
| Session cookies | Critical | Browser → Worker |
| Temporary passwords | High | Admin reset API response |

---

## 2. Trust boundaries

```text
┌──────────────┐  untrusted GPS / headers / body   ┌─────────────────────┐
│  Browser/PWA │ ─────────────────────────────────► │ Cloudflare Worker   │
│  (employee)  │ ◄───────────────────────────────── │ Next.js OpenNext    │
└──────┬───────┘         cookies / HTML/JS          └──────────┬──────────┘
       │                                                      │
       │ publishable key + user JWT                           │ service role
       ▼                                                      ▼
┌──────────────────────┐                         ┌──────────────────────┐
│ Supabase Auth + RLS  │ ◄── same JWT ───────────│ Supabase Postgres    │
│ PostgREST (anon)     │                         │ (RLS + service bypass)│
└──────────────────────┘                         └──────────────────────┘
```

**Rules that must hold:**

1. Browser never receives `SUPABASE_SECRET_KEY`.
2. Punch authorization is decided **only** on the Worker after IP+GPS validation.
3. Direct PostgREST writes must not be able to forge attendance (currently **violated** — SEC-F-001).
4. Cloudflare `cf-connecting-ip` is the only trusted client IP on production Workers.

---

## 3. Actors

| Actor | Capabilities |
|-------|----------------|
| Anonymous | Login page, PWA assets, auth callback |
| EMPLOYEE | Punch, own history/profile |
| ADMIN_VIEWER | Read admin dashboards, reports, audit |
| ADMIN | Mutations: employees, settings, corrections, resets |
| Insider fraudster | GPS spoof, share office Wi‑Fi, collude |
| External attacker | Phishing, CSRF, dependency vulns, credential stuffing |
| Operator / CI | Env misconfiguration (E2E adapter flags) |

---

## 4. Attack surface inventory

### 4.1 Public HTTP

| Path | Auth |
|------|------|
| `/`, `/login` | Public (redirect if session) |
| `/manifest.webmanifest`, `/sw.js`, `/icons/**`, `/brand/**` | Public |
| `/api/auth/**` | Public (code exchange) |

### 4.2 Authenticated employee APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/attendance/today` | no-store |
| GET | `/api/attendance/history` | scoped to self |
| POST | `/api/attendance/check-in` | hybrid validation |
| POST | `/api/attendance/check-out` | hybrid validation |
| GET | `/api/network/my-ip` | discloses matched IP |
| POST | `/api/account/change-password` | re-auth required |

### 4.3 Admin APIs

| Access | Paths |
|--------|-------|
| `requireAdminAccess` (read) | employees GET, attendance GET, export, audit-logs, settings GET, shifts GET |
| `requireAdmin` (write) | employees CUD, activate/deactivate, reset-password, settings PATCH, shifts CUD, attendance correct |

### 4.4 Privileged service-role operations

| Operation | File |
|-----------|------|
| Create Auth user | `app/api/admin/employees/route.ts` |
| Delete Auth user | `app/api/admin/employees/[id]/route.ts` |
| Reset password | `.../reset-password/route.ts` |
| Clear `must_change_password` | `app/api/account/change-password/route.ts` |
| Lookup Auth email | admin employee pages/routes |

### 4.5 Client-controlled inputs

- Email/password login  
- GPS `{latitude,longitude,accuracy}`  
- Admin form fields (Zod-validated)  
- `next` on auth callback (**unsafe**)  
- Headers: `x-forwarded-for`, `x-real-ip`, `x-officepulse-e2e-ip`  
- Excel cell content derived from employee strings  

### 4.6 Secrets / env

| Name | Public? | Storage |
|------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | wrangler vars / build |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | wrangler vars / build |
| `NEXT_PUBLIC_APP_URL` | Yes | wrangler vars |
| `SUPABASE_SECRET_KEY` | **No** | Cloudflare Secret |
| `E2E_TRUSTED_IP_ADAPTER` | N/A | Local Playwright only |

---

## 5. STRIDE summary

| Threat | Example | Mitigations today | Gap |
|--------|---------|-------------------|-----|
| Spoofing | Fake GPS; forged IP headers | Server GPS+IP validation; CF IP preferred | Client GPS always spoofable; XFF off-CF |
| Tampering | Direct RLS update of attendance | Unique (employee,date); API race guard on checkout | **RLS allows self UPDATE/INSERT** |
| Repudiation | Admin actions | `audit_logs` | Password value not audited (good) |
| Information disclosure | Office IP/GPS to all users | Auth required | Full allow-list readable |
| Denial of service | Punch/login flood | None in-app | No rate limits |
| Elevation of privilege | VIEWER → write | `canWriteAdmin` + `is_admin()` RLS | UI-only is not enough — APIs OK |

---

## 6. Attendance integrity model

**Intended:** Only Worker punch routes create/update attendance after `validateAttendanceLocation`, using server timestamps.

**Actual:** Any employee with JWT can mutate own `attendance` via PostgREST (SEC-F-001).

**Inherent residual risks (ACCEPTED_RISK):**

- Browser/OS GPS can be mocked.  
- Office “Wi‑Fi” = shared egress IP; anyone on that NAT passes Wi‑Fi path.  
- iCloud Private Relay / VPN changes egress IP → may force GPS path (correct fail-closed for Wi‑Fi).

---

## 7. E2E trusted IP adapter threat

| Control | Status |
|---------|--------|
| Disabled by default | Yes (`!== "1"`) |
| Off when `NODE_ENV=production` | Yes |
| Off when `NEXT_PUBLIC_APP_ENV=production` | Yes |
| Never overrides `cf-connecting-ip` | Yes |
| Cannot be enabled by browser alone | Yes (server env) |
| Fail-closed on ambiguous prod host | Partial (workers.dev patterns; custom domains rely on NODE_ENV) |
| `E2E_NONPROD_HOST=1` escape hatch | Config risk (SEC-F-010) |

**P0 classification:** Adapter is **not** P0-exposed on a correctly configured Cloudflare production Worker (`NODE_ENV=production` + CF IP). Misconfiguration remains Medium.

---

## 8. PWA / Safari

- SW does not cache HTML/API (`public/sw.js`).  
- Session in HttpOnly cookies via Supabase SSR (asserted in e2e).  
- Safari gesture-gated GPS is UX, not a server bypass.  
- Private Relay does not weaken server rules; it may block Wi‑Fi-only path.

---

## 9. Assumptions

1. Production always runs on Cloudflare Workers with `cf-connecting-ip`.  
2. `SUPABASE_SECRET_KEY` is a Worker Secret, never committed.  
3. Supabase Auth email/password is the only IdP.  
4. Admins are trusted for operational password distribution.  
5. Nonprod authenticated E2E is not yet complete (QA gate open).
