# OfficePulse — Security Remediation Plan

**Date:** 2026-11-14  
**Constraint:** No production deploy / destructive DB changes without Jalil’s approval.  
**Rule:** Do not weaken GPS/IP/auth rules to make tests pass.

---

## Release posture

**NOT PRODUCTION READY** until Critical + High findings are FIXED and VERIFIED.

---

## Priority order (recommended)

### Wave 0 — Immediate (before any further prod reliance)

| Order | Finding | Change | Risk to business rules | Est. |
|-------|---------|--------|------------------------|------|
| 1 | SEC-F-001 | Migration: drop employee `INSERT`/`UPDATE` on `attendance`; punches use service role **after** validation, or security-definer RPCs | None if API paths unchanged | 0.5–1d |
| 2 | SEC-F-002 | Sanitize `next` on auth callback | None | 0.5h |
| 3 | SEC-F-003 | Sanitize Excel cell strings | None | 1–2h |
| 4 | SEC-F-004 | Replace `xlsx` or document ACCEPTED_RISK + F-003 | Export format must stay compatible | 0.5–1d |

### Wave 1 — Hardening (same sprint)

| Order | Finding | Change | Est. |
|-------|---------|--------|------|
| 5 | SEC-F-005 | Production: ignore XFF/X-Real-IP when CF IP missing; fail closed | 2h |
| 6 | SEC-F-006 | Origin allowlist on mutating APIs | 2–4h |
| 7 | SEC-F-009 | Recompute late/early on correction | 1–2h |
| 8 | SEC-F-010 / F-014 | Remove or tightly gate `E2E_NONPROD_HOST`; rely on `NEXT_PUBLIC_APP_ENV` | 1h |
| 9 | SEC-F-013 | Security headers via CF or Next | 2h |
| 10 | SEC-F-011 | Cloudflare rate limiting rules | Ops 1h |

### Wave 2 — Integrity / ops

| Order | Finding | Change |
|-------|---------|--------|
| 11 | SEC-F-008 | Overnight shift math |
| 12 | SEC-F-012 | Reduce password-in-response exposure |
| 13 | SEC-F-007 | Optional: strip allow-list from client payloads |
| 14 | SEC-F-015 | Optional middleware admin role gate |
| 15 | SEC-F-016 | Product decision (ACCEPTED_RISK) |

### Wave 3 — Verification gates

1. Nonprod Supabase + preview Worker.  
2. Automated negative authz + RLS tests.  
3. P0 IP adapter suite green.  
4. Real iPhone Safari + installed PWA sign-off.  
5. Re-run `npm audit`; document residual advisories.

---

## Detailed fix designs (Wave 0)

### SEC-F-001 — RLS attendance write lockdown

**Smallest safe fix:**

```sql
-- migration_attendance_writes_api_only.sql
drop policy if exists "Employees insert own attendance" on attendance;
drop policy if exists "Employees update own attendance" on attendance;

-- Admins may still correct via API using user JWT + is_admin()
create policy "Admins update attendance"
  on attendance for update
  using (public.is_admin())
  with check (public.is_admin());
```

Then change check-in/check-out (and any path that inserts attendance) to use `createServiceClient()` **only after** `validateAttendanceLocation` + identity checks, writing `employee_id` from session (never from body).

**Alternative:** Keep user JWT writes but wrap in `SECURITY DEFINER` functions that embed validation — larger change.

**Regression:**

- Employee PostgREST update → fail.  
- API check-in/out → success.  
- Admin correct → success.  
- ADMIN_VIEWER correct → 403.

### SEC-F-002 — Open redirect

```ts
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/dashboard";
  }
  return next;
}
```

### SEC-F-003 — Formula injection

```ts
function asExcelText(value: unknown): string | number {
  if (typeof value === "number") return value;
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
```

Apply to all user-derived string cells in `buildMonthlyAttendanceWorkbook`.

### SEC-F-005 — Fail closed without CF IP in production

```ts
if (isProductionRuntime()) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return normalizeIp(cfIp);
  return "0.0.0.0"; // do not honor XFF
}
```

---

## Explicit non-goals (this approval cycle)

- Deploying to production Worker  
- Running punch mutations against live Supabase  
- Weakening geofence radius / Wi‑Fi rules for E2E convenience  
- Committing secrets or rotating keys without ops plan  

---

## Approval checklist

Jalil, please approve each wave before implementation:

- [ ] **Wave 0** (F-001, F-002, F-003, F-004 approach)  
- [ ] **Wave 1**  
- [ ] **Wave 2**  
- [ ] Allow nonprod migration apply  
- [ ] Allow production migration apply (after nonprod verify)  

**Preferred reply:** `Approve Wave 0` or list finding IDs to implement first.

---

## SEC-002 status (2026-11-14)

**Wave 0 implemented in nonproduction.** See `SEC_002_IMPLEMENTATION_REPORT.md`.

| Finding | Code | Nonprod verify | Prod |
|---------|------|----------------|------|
| F-001 | Done | RLS negatives PASS | Migration pending approval |
| F-002 | Done | PASS | App deploy pending approval |
| F-003 | Done | PASS | App deploy pending approval |
| F-004 | Done (`exceljs`) | PASS | App deploy pending approval |

**Next approval needed:** production deployment per `SEC_002_DEPLOYMENT_PLAN.md` (not auto-approved).
