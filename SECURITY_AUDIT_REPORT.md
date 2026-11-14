# SEC-001 — OfficePulse Full Source & Production Security Audit Report

**Product:** OfficePulse Attendance (`attendance-app/`)  
**Date:** 2026-11-14  
**Auditor role:** Principal Application Security / Senior Full-Stack / QA Lead (assisted)  
**Stack:** Next.js 16 · React 19 · Cloudflare Workers (OpenNext) · Supabase Auth + Postgres RLS · PWA · Playwright  

**Verdict:** **NOT PRODUCTION READY**

---

## 1. Executive summary

OfficePulse has a **sound intended architecture**: server-side punch validation, hybrid GPS/office-IP rules, role separation (ADMIN / ADMIN_VIEWER / EMPLOYEE), service-role isolation for Auth admin ops, and a fail-closed E2E IP adapter when `NODE_ENV=production`.

The audit found one **Critical** integrity failure: **RLS still allows employees to INSERT/UPDATE their own `attendance` rows** via the publishable Supabase client, bypassing all Worker GPS/IP checks. Until that is closed, attendance records are not trustworthy.

Additional **High** issues: open redirect on auth callback, Excel formula injection, and an unfixable High advisory on `xlsx`.

Identity-gate gaps called out in an earlier architecture review appear **addressed in code** (commit `f8ebba4`, middleware ACTIVE + password enforcement) but are **not VERIFIED** on nonprod accounts.

**No fixes were deployed.** Remediation awaits approval (`SECURITY_REMEDIATION_PLAN.md`).

---

## 2. Deliverables

| Document | Purpose |
|----------|---------|
| `SECURITY_FINDINGS.md` | Finding register (ID, severity, evidence, status) |
| `SECURITY_THREAT_MODEL.md` | Assets, trust boundaries, STRIDE, adapter model |
| `SECURITY_REMEDIATION_PLAN.md` | Ordered fix waves + approval checklist |
| `SECURITY_TEST_EVIDENCE.md` | What was / was not tested |
| `PRODUCTION_RELEASE_CHECKLIST.md` | Release gates + rollback |
| This report | Narrative + attack surface + phase results |

---

## 3. Phase results

### Phase 1 — Architecture & attack surface

Traced documented architecture against code. Inventory in threat model §4.

**Trust boundaries:** Browser (untrusted) → Worker (trusted validation) → Supabase (RLS + service role).  
**Gap:** Browser can also talk to PostgREST directly with the same user JWT; attendance write policies are too permissive.

Secrets: publishable keys in `wrangler.jsonc` (expected); `SUPABASE_SECRET_KEY` documented as Cloudflare Secret only — **not** present in committed vars.

No GitHub Actions workflows in-repo (deploy likely via Cloudflare Git integration).

### Phase 2 — Authentication & authorization

| Check | Result |
|-------|--------|
| Unauthenticated blocked from protected routes | **PASS** (middleware) |
| Employee cannot use admin write APIs | **PASS** (handler `requireAdmin`) |
| ADMIN_VIEWER cannot mutate via API | **PASS** (`canWriteAdmin`) |
| Inactive cannot punch | **PASS** (middleware + route) — needs nonprod verify |
| Password-change bypass | **PASS** in middleware/APIs — needs nonprod verify |
| Session refresh | Delegated to `@supabase/ssr` `getUser()` |
| Cookie flags | Set by Supabase SSR; e2e asserts HttpOnly when run |
| CSRF | **GAP** — no Origin check (SEC-F-006) |
| Admin reset abuse | Admin-only; returns plaintext temp password (SEC-F-012) |
| Delete consistency | Service role cascade; admin-gated |

UI hiding is **not** treated as a control; API/RLS reviewed separately.

### Phase 3 — Supabase security

| Check | Result |
|-------|--------|
| RLS enabled on app tables | **PASS** |
| Employee read own attendance | **PASS** |
| ADMIN_VIEWER read-only at RLS for writes | **PASS** (`is_admin()` for mutations) |
| Unsafe employee attendance INSERT/UPDATE | **FAIL** SEC-F-001 |
| Service role server-only | **PASS** (no client import of secret) |
| Security definer `search_path` | **PASS** (`set search_path = public`) |
| Unique attendance per day | **PASS** |
| Concurrent check-out | **PASS** (null guard) |

Automated RLS negative tests: **not yet run** on nonprod.

### Phase 4 — Attendance integrity

| Check | Result |
|-------|--------|
| Identity from session | **PASS** |
| No client employee_id for punch | **PASS** |
| IP from CF first | **PASS** on Workers |
| GPS Zod ranges | **PASS** (`gpsSchema`) |
| Hybrid GPS/Wi‑Fi rules preserved in `validate.ts` | **PASS** |
| Client validation not trusted | **PASS** (server re-check) |
| Server timestamps | **PASS** |
| Overnight shifts | **FAIL** SEC-F-008 |
| Error leakage | Generally coded messages; some admin paths echo Supabase errors |

**Limits documented:** GPS spoofing; shared public IP = shared Wi‑Fi trust (SEC-F-016 ACCEPTED_RISK).

### Phase 5 — E2E_TRUSTED_IP_ADAPTER

| Requirement | Result |
|-------------|--------|
| Disabled by default | **PASS** |
| Cannot operate when `NODE_ENV=production` | **PASS** |
| Cannot be activated by browser alone | **PASS** |
| Does not override `cf-connecting-ip` | **PASS** |
| Fail closed | **PARTIAL** (custom domains / `E2E_NONPROD_HOST`) |
| Automated production-off proof | **PASS** (unit) |

**Not classified P0 production exposure** for a correctly configured CF Worker. Misconfiguration = Medium (SEC-F-010).

### Phase 6 — Cloudflare Worker deployment

| Check | Result |
|-------|--------|
| Secrets as Worker secrets | Documented; not verified live dashboard |
| No secrets in git | **PASS** for service role |
| Source maps / debug endpoints | No explicit debug API found |
| Security headers | **MISSING** SEC-F-013 |
| CORS | Same-origin app pattern; no open `Access-Control-Allow-Origin: *` found |
| Cache-Control on private APIs | **PASS** for today/my-ip |
| Test config accidental prod | Adapter gated; checklist required |

Live destructive tests: **not performed**.

### Phase 7 — API & input security

Zod used on major mutating bodies. Mass assignment limited by schemas. IDOR on admin IDs gated by admin auth. Excel formula injection **OPEN**. No app rate limits. Export requires `requireAdminAccess`.

### Phase 8 — PWA & Safari

SW installability-only; no HTML/API cache. Safari gesture GPS is UX. Private Relay does not silently accept Wi‑Fi path. Real-device sign-off **incomplete**.

### Phase 9 — Dependencies

| Scope | Result |
|-------|--------|
| Production `npm audit` | 6 vulns; **xlsx High, no fix** |
| Dev eslint chain | Moderate/High tooling advisories — low runtime impact |
| Lockfile | Present (`package-lock.json`) |
| CI secrets | No workflow files in repo |

### Phase 10 — Remediation

Fixes **not applied**. See `SECURITY_REMEDIATION_PLAN.md` for Wave 0–2 and approval checklist.

---

## 4. Finding severity board

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| SEC-F-001 | Critical | RLS self-write forges attendance | OPEN |
| SEC-F-002 | High | Auth callback open redirect | OPEN |
| SEC-F-003 | High | Excel formula injection | OPEN |
| SEC-F-004 | High | `xlsx` advisory, no fix | OPEN |
| SEC-F-005 | Medium | Trust XFF when CF IP absent | OPEN |
| SEC-F-006 | Medium | No CSRF Origin checks | OPEN |
| SEC-F-007 | Medium | Office IP/GPS readable to all users | OPEN |
| SEC-F-008 | Medium | Overnight shift late/early wrong | OPEN |
| SEC-F-009 | Medium | Correction leaves late/early stale | OPEN |
| SEC-F-010 | Medium | `E2E_NONPROD_HOST` escape hatch | OPEN |
| SEC-F-011 | Medium | No rate limiting | OPEN |
| SEC-F-012 | Low | Temp password in JSON | OPEN |
| SEC-F-013 | Low | Missing security headers | OPEN |
| SEC-F-014 | Low | Incomplete prod host denylist | OPEN |
| SEC-F-015 | Low | No edge admin role gate | OPEN |
| SEC-F-016 | Low | GPS / shared-IP inherent | ACCEPTED_RISK |
| SEC-F-017 | Low | Publishable key in wrangler | ACCEPTED_RISK* |
| SEC-F-018 | — | Identity middleware gate | FIXED (unverified) |
| SEC-F-019 | — | E2E adapter prod off | FIXED + unit VERIFIED |

\*Acceptability of F-017 depends on closing F-001.

---

## 5. Recommended remediation order (for approval)

1. **SEC-F-001** — Lock down attendance RLS; privileged API writes only  
2. **SEC-F-002** — Safe `next` path  
3. **SEC-F-003** (+ F-004 decision) — Excel sanitization / library  
4. **SEC-F-005, F-006, F-009, F-010, F-013, F-011** — Hardening wave  
5. Nonprod NAZ suite + Safari/PWA gates → then production migration  

Reply **`Approve Wave 0`** (or specific finding IDs) to authorize implementation. No automatic deploy.

---

## 6. Positive controls (retain)

- Server re-validates every punch (`lib/attendance/validate.ts`)  
- `cf-connecting-ip` preferred; e2e header never overrides it  
- Check-out optimistic concurrency on `check_out_time IS NULL`  
- Password change re-authenticates with current password  
- `must_change_password` cleared via service role (employees cannot self-clear under RLS)  
- ADMIN vs ADMIN_VIEWER split in API + RLS  
- PWA SW explicitly excludes API/HTML caching  
- Unique `(employee_id, attendance_date)` constraint  

---

## 7. Sign-off

| Item | Value |
|------|-------|
| Production ready? | **NO** |
| Blocking issues | SEC-F-001, F-002, F-003, F-004; incomplete nonprod/Safari gates |
| Next action | Owner approval of Wave 0 remediation |
