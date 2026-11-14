# OfficePulse — Security Findings Register

**Audit ID:** SEC-001  
**Date:** 2026-11-14  
**Scope:** `attendance-app/` source, schema/migrations, Worker config, Playwright suite  
**Method:** Static code review + config inspection + `npm audit` + existing unit security tests  
**Production destructive tests:** Not performed (per engagement rules)

**Statuses:** `OPEN` | `FIXED` | `VERIFIED` | `ACCEPTED_RISK`  
**SEC-002 update:** 2026-11-14 — Wave 0 implemented in nonprod; production deploy **not** authorized.

---

## Summary counts (post SEC-002 Wave 0)

| Severity | OPEN | FIXED / VERIFIED (nonprod) | ACCEPTED_RISK |
|----------|------|------------------------------|---------------|
| Critical | 0 | 1 (F-001 FIXED, nonprod VERIFIED) | 0 |
| High | 0* | 3 (F-002/003/004 FIXED) | 0 |
| Medium | 5 | 2 (F-005/F-010 FIXED unit) | 0 |
| Low | 4 | 0 | 1 |
| Info | 0 | 0 | 1 |

\*Wave 0 Highs closed in code. Residual `npm audit` Highs remain in OpenNext/`glob` (out of F-004 SheetJS scope).

---

## SEC-F-001 — Employees can forge attendance via Supabase RLS

| Field | Value |
|-------|--------|
| **Severity** | Critical |
| **Component** | `supabase/schema.sql` RLS on `attendance` |
| **Status** | **FIXED** (nonprod **VERIFIED**; production migration pending approval) |
| **Evidence** | SEC-002 dropped employee INSERT/UPDATE policies; punches use `createServiceClient()` after validation. QA RLS probes: INSERT/UPDATE denied; DELETE cannot remove visible row; SELECT own OK. |
| **Exploit path** | (closed on nonprod) PostgREST self-write bypass. |
| **Preconditions** | — |
| **Business impact** | Mitigated when migration + service-role API are both live. |
| **Remediation** | Done in `migration_attendance_writes_api_only.sql` + check-in/out/correct routes. |
| **Regression test** | `tests/e2e/security-rls-attendance.spec.ts` — pass on officepulse-qa. |

---

## SEC-F-002 — Open redirect on `/api/auth/callback`

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Component** | `app/api/auth/callback/route.ts:7–13` |
| **Status** | **FIXED** |
| **Evidence** | `lib/auth/safe-redirect.ts` + callback uses `safeInternalPath`. |
| **Exploit path** | Mitigated. |
| **Remediation** | Allowlist internal paths only. |
| **Regression test** | `unit-safe-redirect.spec.ts` + `security-authz` callback probes — pass. |

---

## SEC-F-003 — Excel formula injection in attendance export

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Component** | `lib/excel/export.ts:45–77` |
| **Status** | **FIXED** |
| **Evidence** | `lib/excel/sanitize.ts` + ExcelJS export forces text/`'` prefix; workbook reload test asserts non-formula cells. |
| **Remediation** | Done. |
| **Regression test** | `unit-excel-security.spec.ts` — pass. |

---

## SEC-F-004 — Vulnerable `xlsx` dependency (no upstream fix)

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Component** | `package.json` → `xlsx@^0.18.5`; `npm audit` GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9 |
| **Status** | **FIXED** |
| **Evidence** | `xlsx` removed; `exceljs@4.4.0` used for export. `npm audit` no longer reports SheetJS GHSA-4r6h / GHSA-5pgg. Residual Highs: OpenNext/`glob` toolchain. |
| **Remediation** | Replaced with ExcelJS. |
| **Regression test** | Export workbook build + formula tests pass. |

---

## SEC-F-005 — Spoofable `x-forwarded-for` / `x-real-ip` when CF IP absent

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Component** | `lib/network/ip.ts:88–96` |
| **Status** | **FIXED** (unit VERIFIED) |
| **Evidence** | Production runtime without `cf-connecting-ip` returns `0.0.0.0` (ignores XFF/X-Real-IP/E2E header). |
| **Remediation** | Done in `lib/network/ip.ts`. |
| **Regression test** | `unit-ip-security.spec.ts` SEC-F-005 cases — pass. |

---

## SEC-F-006 — No CSRF Origin/Referer checks on state-changing APIs

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Component** | All cookie-authenticated `POST`/`PATCH`/`DELETE` under `app/api/**` |
| **Status** | OPEN |
| **Evidence** | No `Origin`/`Referer` validation found. Relies on browser `SameSite` cookie behavior from `@supabase/ssr` (typically Lax — blocks many cross-site POSTs). |
| **Exploit path** | Cross-site request if cookies are `SameSite=None` or older browsers; or same-site subdomain compromise. |
| **Preconditions** | Victim has active session; attacker can trigger credentialed request. |
| **Business impact** | Forced check-in/out, admin mutations if session attached. |
| **Remediation** | Require `Origin` match `NEXT_PUBLIC_APP_URL` (or same host) on mutating routes; optional CSRF token. |
| **Regression test** | POST check-in with evil `Origin` → 403. |

---

## SEC-F-007 — All authenticated users can read office geofence + IP allow-list

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Component** | `supabase/schema.sql:233–248`; punch UI/`/api/attendance/today` |
| **Status** | OPEN |
| **Evidence** | RLS `Authenticated can read office settings/locations` with `using (true)`. Needed for client UX, but discloses target IP/GPS for spoofing. |
| **Exploit path** | Authenticated employee reads settings → crafts GPS spoof or IP spoof (off-CF). |
| **Preconditions** | Any ACTIVE employee account. |
| **Business impact** | Lowers bar for attendance fraud when combined with GPS spoofing (inherent) or F-005. |
| **Remediation** | Prefer server-only validation responses (`ok`/`code`) without returning full allow-list to clients; or accept as operational necessity (`ACCEPTED_RISK` with GPS spoofing limits documented). |
| **Regression test** | N/A if accepted; else assert today API strips `allowed_office_ips`. |

---

## SEC-F-008 — Overnight shifts break late/early math

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Component** | `lib/attendance/timezone.ts:72–93` |
| **Status** | OPEN |
| **Evidence** | `isLate` / `isEarlyLeave` compare minutes-since-midnight only; no wrap for `start > end` shifts. |
| **Exploit path** | Misclassification of punctuality for night shifts (integrity of flags/reports), not auth bypass. |
| **Preconditions** | Shift with end before start (overnight). |
| **Business impact** | Incorrect LATE/EARLY_LEAVE reporting and Excel flags. |
| **Remediation** | Detect overnight shifts; adjust comparison across midnight. |
| **Regression test** | Unit: shift 22:00–06:00 check-in 23:00 → not late (per grace rules). |

---

## SEC-F-009 — Admin correction does not recompute punctuality flags

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Component** | `app/api/admin/attendance/[id]/correct/route.ts:36–43` |
| **Status** | OPEN |
| **Evidence** | Updates times + `total_work_minutes` + `status=CORRECTED`; leaves `is_late` / `is_early_leave` unchanged. |
| **Exploit path** | Not attacker-driven; admin correction leaves stale integrity flags in reports. |
| **Preconditions** | Admin corrects times. |
| **Business impact** | Incorrect compliance reporting after legitimate corrections. |
| **Remediation** | Recompute flags from corrected times + employee shift + office TZ. |
| **Regression test** | Correct late check-in to on-time → `is_late=false`. |

---

## SEC-F-010 — `E2E_NONPROD_HOST=1` can weaken production hostname denylist

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Component** | `lib/network/ip.ts:44–45`, `65–69` |
| **Status** | **FIXED** (unit VERIFIED) |
| **Evidence** | `NEXT_PUBLIC_APP_ENV=production` forces denied host / disables adapter even if `E2E_NONPROD_HOST=1`. |
| **Remediation** | Done. |
| **Regression test** | `unit-ip-security` SEC-F-010 case — pass. |

---

## SEC-F-011 — No rate limiting on auth/punch/admin reset

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Component** | Login (`app/login`), punch APIs, `reset-password` |
| **Status** | OPEN |
| **Evidence** | No application-level or documented CF rate-limit rules in repo. |
| **Exploit path** | Credential stuffing; punch spam; admin reset abuse (admin-only). |
| **Preconditions** | Network reachability to Worker. |
| **Business impact** | Account takeover attempts; noise in attendance. |
| **Remediation** | Cloudflare WAF rate rules on `/login`, `/api/attendance/*`, `/api/admin/employees/*/reset-password`. |
| **Regression test** | Manual/CF rule verification in staging. |

---

## SEC-F-012 — Temporary password returned in JSON response body

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Component** | `app/api/admin/employees/[id]/reset-password/route.ts:135–143` |
| **Status** | OPEN |
| **Evidence** | Response includes `credentials.temporary_password`. Behind `requireAdmin()`. May appear in browser history, proxies, admin XSS, logs. |
| **Exploit path** | Compromised admin browser / XSS / verbose logging. |
| **Preconditions** | Admin privileges or access to response logs. |
| **Business impact** | Account takeover of reset user. |
| **Remediation** | Show once in UI only; avoid logging; prefer invite-link flow; audit without password. |
| **Regression test** | Ensure server logs do not print password (log scrubbing). |

---

## SEC-F-013 — Missing security headers

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Component** | `next.config.ts`, `wrangler.jsonc`, Worker responses |
| **Status** | OPEN |
| **Evidence** | No CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` configured in app config. |
| **Exploit path** | Clickjacking, broader XSS impact, mixed content edge cases. |
| **Preconditions** | Attacker serves framing page / injects script. |
| **Business impact** | Defense-in-depth gap. |
| **Remediation** | Add headers via `next.config.ts` headers or CF Transform Rules. |
| **Regression test** | Smoke assert response headers on `/login`. |

---

## SEC-F-014 — Production host denylist incomplete for custom domains

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Component** | `lib/network/ip.ts:52–58` |
| **Status** | OPEN |
| **Evidence** | Denylist matches `office-pulse.workers.dev` patterns only. Custom domains fall through; protection then depends on `NODE_ENV`/`NEXT_PUBLIC_APP_ENV=production`. |
| **Remediation** | Drive denylist from `NEXT_PUBLIC_APP_ENV` exclusively; treat unknown public hosts as production when env says production. |
| **Regression test** | Custom host + production env → adapter off. |

---

## SEC-F-015 — Middleware does not enforce admin role on `/admin` and `/api/admin`

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Component** | `lib/supabase/middleware.ts` (returns after identity gate); page/API `requireAdmin*` |
| **Status** | OPEN |
| **Evidence** | Employees can hit `/admin/**` URLs; pages redirect. APIs enforce `requireAdmin`/`requireAdminAccess`. Not a direct bypass if handlers correct. |
| **Remediation** | Optional edge role check for defense in depth. |
| **Regression test** | Employee GET `/api/admin/employees` → 403 (already expected). |

---

## SEC-F-016 — GPS spoofing & shared public IP (inherent)

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Component** | Browser Geolocation + public IP Wi‑Fi model |
| **Status** | ACCEPTED_RISK |
| **Evidence** | Clients can spoof GPS; office Wi‑Fi detected via **shared public IP** (any device on that NAT). Documented product limit. |
| **Business impact** | Determined attackers can fake presence without MDM/attestation. |
| **Remediation** | Product decision: MDM, hardware tokens, photo attestation, or accept. |
| **Regression test** | N/A — document in threat model. |

---

## SEC-F-017 — Publishable Supabase key committed in `wrangler.jsonc`

| Field | Value |
|-------|--------|
| **Severity** | Info / Low |
| **Component** | `wrangler.jsonc:17–19` |
| **Status** | ACCEPTED_RISK (if RLS hardened) |
| **Evidence** | `NEXT_PUBLIC_*` values are public by design. **Secret key must not appear** — confirmed absent from `wrangler.jsonc` vars. Risk multiplies with F-001. |
| **Remediation** | Keep public; fix F-001 RLS. Rotate if ever combined with secret leak. |

---

## Previously addressed (code present; verification pending)

| ID | Topic | Evidence | Status |
|----|--------|----------|--------|
| SEC-F-018 | Inactive / forced-password session bypass | middleware + `security-authz` API probes | FIXED; browser VERIFIED partial on nonprod |
| SEC-F-019 | E2E adapter disabled when `NODE_ENV=production` | `lib/network/ip.ts`; unit-ip-security | **VERIFIED** (unit) |

---

## Negative authorization tests (to add — currently incomplete)

Existing: `tests/e2e/unit-ip-security.spec.ts`, gated e2e specs (many skipped without nonprod creds).  
Missing: automated RLS PostgREST negative tests; CSRF Origin tests; open-redirect tests; employee-vs-admin API matrix on nonprod.
