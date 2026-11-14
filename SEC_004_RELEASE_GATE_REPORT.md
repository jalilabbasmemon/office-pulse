# SEC-004 — Release Gate Report

**Date:** 2026-11-14  
**Scope:** QA / nonproduction only  
**Production Worker / production DB:** **not modified**

---

## Verdict

# **NO-GO** for production (and **NO-GO** for emergency hotfix until authorized punch success is green)

Architecture and test harness corrected so Playwright no longer requires a privileged key for punches. **Authorized check-in/out still fails** until the **QA Worker / local Next** is given the **officepulse-qa** `SUPABASE_SECRET_KEY` (server-side only).

---

## What changed (SEC-004)

| Area | Change |
|------|--------|
| Punch tests | Authenticated `/api/attendance/*` only; verify via `/api/attendance/today`, admin audit, export |
| Privileged access | Optional Node fixture `qa-admin.ts` for day reset from `.env.qa.local` — **never** sent to browser |
| QA Worker | `wrangler.qa.jsonc`: name `office-pulse-qa`, Supabase QA only, `APP_ENV=qa`, `E2E_TRUSTED_IP_ADAPTER=1` |
| Production Worker | `wrangler.jsonc` sets `NEXT_PUBLIC_APP_ENV=production` (adapter hard-off) |
| IP adapter | Allowed on Workers only when `APP_ENV=qa\|staging\|preview` + flag; production fail-closed preserved |
| Setup | `docs/QA_WORKER_SECRET_SETUP.md`, `env.qa.example`, `scripts/put-qa-worker-secret.ps1` |

---

## Exact tests executed

### A — Auth + Safari automation + IP units + viewer rejection

```
npx playwright test tests/e2e/auth.spec.ts tests/e2e/safari-install-prompt.spec.ts \
  tests/e2e/unit-ip-security.spec.ts tests/e2e/security-punch-matrix.spec.ts:221 \
  --project=chromium-desktop --project=webkit-iphone
```

**Result:** **39 passed / 1 skipped / 0 failed**  
(Skip: chromium project skip of webkit-only install-prompt.)

### B — Authorized punch matrix (blocked without QA server secret)

```
npx playwright test tests/e2e/security-punch-matrix.spec.ts --project=chromium-desktop --project=webkit-iphone
```

**Result:** GPS check-in → **500 Invalid API key** (placeholder `SUPABASE_SECRET_KEY` on local Next).  
Serial suite aborted remaining success tests. Rejection suite re-run separately — pass.

### C — RLS integrity (prior + reconfirmed)

Employee direct INSERT/UPDATE/DELETE denied on `officepulse-qa` — **PASS**.

---

## Database verification evidence

| Check | Evidence |
|-------|----------|
| QA RLS policies | SELECT + admin UPDATE only on `attendance` (no employee write) |
| Today reset for fixtures | MCP `delete` on QAEMP01 today (nonprod) before attempted matrix |
| Punch row after success | **Not obtained** — server secret missing |
| Audit / export after correction | **Not obtained** — depends on success path |

---

## QA Worker configuration checklist

| Item | Status |
|------|--------|
| `wrangler.qa.jsonc` → Worker `office-pulse-qa` only | Yes |
| Public vars → `hlcwsnhhmgjuxpebycyg` only | Yes |
| `SUPABASE_SECRET_KEY` as Cloudflare secret | **Pending operator** — see `docs/QA_WORKER_SECRET_SETUP.md` |
| No privileged key in Playwright browser env | Yes |
| E2E adapter impossible when `APP_ENV=production` | Yes (unit tests) |
| QA Worker deploy | **Not completed** this session (blocked on secret) |

---

## Clean release artifact

| Field | Value |
|-------|-------|
| Commit | `2bfbf18a20b328c12d3668df32dcae6fbd2e9dbb` |
| Subject | `sec-004: harden attendance APIs and ship QA punch release harness` |
| Branch | `main` (ahead of origin by 1; **not pushed**) |
| Typecheck | `npx tsc --noEmit` — pass |

Working tree was consolidated into this RC. **Re-run authorized punch matrix after placing QA secret**, then tag if green.

Production build must use `wrangler.jsonc` (not `wrangler.qa.jsonc`) so `E2E_TRUSTED_IP_ADAPTER` is absent and `APP_ENV=production`.

---

## Remaining security risks

1. **P0:** Authorized punch success unverified (QA secret not configured on app server).  
2. **P0 (live):** Production still on permissive RLS until approved hotfix — separate decision after (1).  
3. **P0:** Real iPhone Safari/PWA unsigned.  
4. **P1:** OpenNext/`glob@13` moderate residual (build-time).  
5. **P2:** Non-HttpOnly auth cookie chunks observed in local SSR.

---

## Unblock steps (operator — no secrets in chat)

1. Copy `env.qa.example` → `.env.qa.local`; set **officepulse-qa** secret + disposable passwords.  
2. `.\scripts\put-qa-worker-secret.ps1` then `npm run deploy:qa` **or** run local Next with `.env.qa.local`.  
3. `E2E_ALLOW_PUNCH=1` + disposable `E2E_*` →  
   `npx playwright test tests/e2e/security-punch-matrix.spec.ts --project=chromium-desktop`  
4. Expect **0 failed** on authorized suite; attach evidence to this report.  
5. Then decide **emergency Worker+RLS hotfix** vs wait for Safari human sign-off (recommended: hotfix can proceed once punch matrix is green; Safari stays a separate gate).

---

## GO / NO-GO

| Gate | Status |
|------|--------|
| Zero High/Critical app advisories (post-override) | Pass |
| RLS denies direct writes (QA) | Pass |
| Unauthorized / viewer / inactive / force-pw | Pass |
| Authorized check-in/out + admin correction | **FAIL / blocked** |
| Real-device Safari | Pending |
| Clean RC commit | `2bfbf18a20b328c12d3668df32dcae6fbd2e9dbb` |
| **Production** | **NO-GO** |
| **Emergency hotfix** | **NO-GO until punch success green** |
