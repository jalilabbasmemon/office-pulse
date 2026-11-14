# Security Test Evidence — SEC-002 / SEC-003 / SEC-004

**Date:** 2026-11-14  
**Nonprod:** `officepulse-qa` (`hlcwsnhhmgjuxpebycyg`)  
**Production probes:** none

## SEC-004 design correction

- Employee/admin punches: **authenticated public API only**.  
- Privileged Supabase secret: **Next / QA Worker only** (`.env.qa.local` or `wrangler secret`).  
- Playwright does **not** require `E2E_QA_SUPABASE_SECRET_KEY` for attendance actions.  
- Optional Node fixture `tests/e2e/helpers/qa-admin.ts` may use the QA secret for **day reset only**.

## Commands

### Auth + Safari + IP + viewer rejection (green)

```bash
set E2E_QA_SUPABASE_URL=https://hlcwsnhhmgjuxpebycyg.supabase.co
set E2E_TRUSTED_IP_ADAPTER=1
set E2E_ALLOW_PUNCH=1
# disposable E2E_* accounts…
npx playwright test tests/e2e/auth.spec.ts tests/e2e/safari-install-prompt.spec.ts ^
  tests/e2e/unit-ip-security.spec.ts tests/e2e/security-punch-matrix.spec.ts:221 ^
  --project=chromium-desktop --project=webkit-iphone
```

**Result:** **39 passed / 1 skipped / 0 failed**

### Authorized punch matrix (blocked — server secret)

```bash
npx playwright test tests/e2e/security-punch-matrix.spec.ts --project=chromium-desktop --project=webkit-iphone
```

**Result:** check-in **500** `Invalid API key` with placeholder `SUPABASE_SECRET_KEY`.  
**Unblock:** configure officepulse-qa secret per `docs/QA_WORKER_SECRET_SETUP.md`, then re-run.

### RLS negatives

Employee direct INSERT/UPDATE/DELETE denied — **PASS** (QA).

## Mandatory matrix

| Case | Result |
|------|--------|
| Employee direct writes denied | **PASS** |
| Invalid GPS + bad IP rejected | **PASS** (authz suite) |
| ADMIN_VIEWER correction rejected | **PASS** |
| Inactive / force-password | **PASS** |
| GPS check-in/out + DB/today verify | **BLOCKED** (QA server secret) |
| Office-IP check-in/out | **BLOCKED** |
| Duplicate / concurrent | **BLOCKED** |
| Admin correction + audit + export | **BLOCKED** |

## Production

No production credentials used for QA punches. No production migration. No production Worker deploy.
