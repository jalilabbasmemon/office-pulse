# SEC-003 — Release Readiness Report

**Role lens:** Principal Security Engineer / Release Manager / QA Lead  
**Date:** 2026-11-14  
**Authorization:** Nonproduction work only. **Production deployment: NOT APPROVED / NOT PERFORMED.**

---

## Verdict

# **NO-GO for production**

Mandatory evidence incomplete: authorized punch success path, QA Worker secret, real-device Safari sign-off, production backup/PITR verification, and a clean tagged release artifact.

---

## Exact release artifact

| Field | Value |
|-------|-------|
| Base git commit | `f8ebba4c4f218de90d6da8c66e47828652d989cf` |
| Working tree | **Dirty** (SEC-002/003 changes uncommitted) |
| Index tree object (current disk) | `d62c29fc8e52acd119bc00c5236e567f6dd2a939` |
| App package | `attendance-app@0.1.0` |
| OpenNext | `@opennextjs/cloudflare@1.20.15` |
| ExcelJS | `exceljs@4.4.0` (uuid overridden → `11.1.1`) |
| Production Worker name | `office-pulse` (**not deployed**) |
| QA Worker name | `office-pulse-qa` via `wrangler.qa.jsonc` (**config ready; secret not set; deploy deferred**) |
| Nonprod Supabase | `officepulse-qa` / `hlcwsnhhmgjuxpebycyg` |
| Production Supabase | `jniyfhpwrjofdljqsdwd` (**untouched**) |

Do not treat the dirty tree as a releasable artifact. Cut a clean commit/tag after Task A completes.

---

## Task results

### A — Authorized punch verification

| Item | Status |
|------|--------|
| Isolated QA Worker config (`wrangler.qa.jsonc`) | Ready |
| QA privileged credential as Worker/CI secret only | **BLOCKED** — no QA service role available without dashboard extraction; process env placeholder only; production `.env.local` secret **must not** be pointed at QA |
| Punch matrix harness | `tests/e2e/security-punch-matrix.spec.ts` + `scripts/sec003-punch-verify.mjs` |
| Rejection / authz coverage (5, 8–10 + RLS) | **PASS** on chromium + webkit-iphone |
| Success coverage (1–4, 6–7) + DB verify | **NOT RUN** (require QA secret) |
| Mocked authorization path? | **No** — success tests skip rather than mock |

**To unblock Task A (operator):**

```bash
# From Supabase dashboard → officepulse-qa → API → secret/service_role
# Never commit. Never use production project secret.
npx wrangler secret put SUPABASE_SECRET_KEY --config wrangler.qa.jsonc
set E2E_QA_SUPABASE_SECRET_KEY=<qa-secret>
set E2E_ALLOW_PUNCH=1
npx playwright test tests/e2e/security-punch-matrix.spec.ts --project=chromium-desktop
```

### B — Production deployment safety

Updated:

- `SEC_002_DEPLOYMENT_PLAN.md` — backup/PITR, exact SHA, maintenance window, access restriction, **live Worker before RLS**, post-migration negatives, punch/admin/export smokes, explicit that preview ≠ production  
- `SEC_002_ROLLBACK_PLAN.md` — prefer service-role Worker restore; **do not** default to restoring vulnerable RLS; emergency RLS path requires written approval + time-box + re-lock  

### C — Residual dependency review

| Advisory / package | Installed | Reachable in production Worker runtime? | Patched / mitigation | Residual |
|--------------------|-----------|-------------------------------------------|----------------------|----------|
| GHSA-5j98-mcp5-4vw2 `glob` CLI `-c/--cmd` via `@node-minify/core` | was `10.3.3` → **override `10.5.0`** | **No** — build toolchain only; CLI not invoked | `package.json` overrides | High cleared |
| GHSA-3g3m-2fjr-6pw4 / minimatch via `glob@13.0.6` (`@opennextjs/cloudflare`) | `glob@13.0.6` | **No** for request path — OpenNext build/bundler | Upstream fix would need OpenNext bump; `npm audit fix --force` proposes **breaking** `@opennextjs/cloudflare@0.3.0` — **rejected** | **Moderate residual risk accepted** (documented, not suppressed) |
| GHSA-w5hq-g745-h8pq `uuid` via ExcelJS | was `8.3.2` → **override `11.1.1`** | ExcelJS calls `uuid.v4()` without caller `buf`; advisory targets v3/v5/v6 + buf | Override applied | Cleared from audit for uuid/exceljs |
| SheetJS `xlsx` | removed | N/A | ExcelJS + `asExcelText` | Gone |

`npm audit` after overrides: **0 high / 0 critical / 12 moderate** (OpenNext/glob/minimatch + eslint toolchain). Findings are **not** silenced with `audit --omit` or false ignore entries.

### D — Safari verification

| Item | Status |
|------|--------|
| QA-002 Safari fixes preserved | Yes (InstallPrompt, pressSequentially, iosHint) |
| Automated P0 auth / Safari / security suite | **92 passed** (chromium-desktop + webkit-iphone) |
| Real-device checklist | `QA_REAL_DEVICE_SAFARI_CHECKLIST.md` + `QA_REAL_IPHONE_CHECKLIST.md` |
| Human real-device sign-off | **PENDING** — `E2E_REAL_IPHONE_PASS` not set |
| Residual: auth cookies HttpOnly | Annotated — local SSR may use non-HttpOnly chunks; track as XSS residual |

---

## Test results (summary)

```
92 passed | 12 skipped | 0 failed
Projects: chromium-desktop, webkit-iphone
```

Skips are **not** passes. Critical skip class: authorized punch success (QA secret).

Full table: `SECURITY_TEST_EVIDENCE.md`.

---

## Deployment sequence (when production is later approved)

1. Preconditions P1–P10 in `SEC_002_DEPLOYMENT_PLAN.md`  
2. Maintenance window + access restriction  
3. Verify production backup/PITR  
4. Deploy **exact SHA** to live Worker `office-pulse` with production secret (no E2E adapters)  
5. Confirm live deployment id  
6. Apply `migration_attendance_writes_api_only.sql` on production  
7. Immediate RLS negatives  
8. Authorized punch + admin correction/export smokes  
9. Exit window / monitor  

**Not done in SEC-003.**

---

## Outstanding security risks

1. **P0 blocker:** Authorized API punch success unverified end-to-end without QA service role.  
2. **P0 blocker:** Real iPhone Safari/PWA unsigned.  
3. **P1 residual:** OpenNext → `glob@13` / minimatch moderate advisories (build-time).  
4. **P2 residual:** Non-HttpOnly auth cookie chunks in local SSR observation.  
5. **Process:** Dirty tree / untagged artifact — do not promote until clean tag.  
6. **Ops:** Production backup/PITR verification not recorded.

---

## GO / NO-GO

| Decision | **NO-GO** |
|----------|-----------|
| Production Worker deploy | **Forbidden** |
| Production Supabase migration | **Forbidden** |
| Next action | Set QA secret → finish Task A punch matrix → human Safari sign-off → tag SHA → Jalil approval of deployment plan |

---

## Deliverables touched

| File | Action |
|------|--------|
| `SEC_002_DEPLOYMENT_PLAN.md` | Rewritten |
| `SEC_002_ROLLBACK_PLAN.md` | Rewritten |
| `SECURITY_TEST_EVIDENCE.md` | Updated |
| `PRODUCTION_RELEASE_CHECKLIST.md` | Updated |
| `QA_REGRESSION_REPORT.md` | Updated |
| `QA_REAL_DEVICE_SAFARI_CHECKLIST.md` | Created |
| `wrangler.qa.jsonc` | Created |
| `tests/e2e/security-punch-matrix.spec.ts` | Created |
| `SEC_003_RELEASE_READINESS_REPORT.md` | Created (this file) |
