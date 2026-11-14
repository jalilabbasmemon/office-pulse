# QA-002 — Test Evidence

**Date:** 2026-11-14  
**Role:** Senior QA + Security Review  
**Verdict:** **Safari production release NOT approved**

## 1. Environment

| Item | Value |
|---|---|
| Production Supabase (untouched) | `jniyfhpwrjofdljqsdwd` / attendance system |
| Nonprod Supabase (created) | `hlcwsnhhmgjuxpebycyg` / **officepulse-qa** |
| Nonprod URL | `https://hlcwsnhhmgjuxpebycyg.supabase.co` |
| Disposable accounts | `qa-admin@`, `qa-viewer@`, `qa-employee@`, `qa-forcepw@`, `qa-inactive@` `@officepulse.test` |
| Local app under test | `http://localhost:3000` with QA env overrides |
| Playwright browsers | `D:\ms-playwright` |
| Evidence dirs | `test-results/artifacts/`, `playwright-report/` (sanitized; no secrets committed) |

Production attendance rows and office settings were **not** modified.

## 2. Full browser matrix (unauthenticated baseline)

Command: `npx playwright test` (all 5 projects), no `E2E_*` creds.

| Project | Result summary |
|---|---|
| chromium-desktop | included |
| firefox-desktop | included |
| webkit-desktop | included |
| webkit-iphone | included |
| chromium-android | included |

**Totals:** **112 passed**, **163 skipped**, **0 failed**

Skipped ≠ passed. Skips were credential/fixture/manual gates (see §3).

## 3. Skip inventory (by category)

### A. Missing credentials (nonprod `E2E_*` not set in that run)

AUTH-001…007, admin dashboard, ADMIN-001…007, REPORT-001/002, GEO UI paths needing login, ATT UI, PWA-002, UI-004 — **per project**.

Reason string: `Skipped: set E2E_* credentials for … against a nonproduction database.`

### B. Missing fixtures / flags

| Skip reason | Tests |
|---|---|
| `E2E_ALLOW_PUNCH` unset | GEO-001/002 punch, ATT-006, ATT-009 |
| `E2E_WIFI_ONLY_DISABLED` unset | GEO-004 |
| `E2E_EXPECT_NO_LOCATIONS` unset | GEO-010 E2E API |
| Project filter (not iphone) | GEO-007, GEO-009 tip, Safari WebKit-only UI |
| Project filter (not webkit) | Safari WebKit login console test on Chromium/Android |

### C. Manual-only

| Test | Reason |
|---|---|
| REAL-IPHONE-SAFARI manual smoke | `E2E_REAL_IPHONE_PASS !== 1` — human checklist required |
| P0 gate meta `E2E_REQUIRE_AUTH=1` | Inactive unless release CI sets flag |

### D. Unsupported / N/A environment

None beyond intentional project filters above.

## 4. Authenticated nonprod runs (officepulse-qa)

Env pointed at QA project (not production). Fresh webserver (`E2E_FORCE_WEBSERVER=1`).

### Chromium desktop — auth matrix

**8/8 AUTH passed** (AUTH-001…007 + admin dashboard) + IP security units.

### WebKit iPhone — after fixes

**9/9 passed:** full AUTH matrix + install-prompt regression.

### Confirmed defects fixed this pass

| ID | Severity | Browsers | Root cause | Files | Fix |
|---|---|---|---|---|---|
| QA002-F1 | P0 | iPhone WebKit | InstallPrompt overlay intercepted Sign in | `components/pwa/install-prompt.tsx` | Hide prompt on `/login` + `/change-password` |
| QA002-F2 | P0 | WebKit automation | `fill()` left `#email` empty → HTML5 blocked submit | `tests/e2e/helpers/auth.ts` | `pressSequentially` + value assert |
| QA002-F3 | P1 | WebKit/iOS | `isIosSafari()` in render caused hydration mismatch | `attendance-card.tsx` | Use post-mount `iosHint` for Private Relay tip |
| QA002-F4 | P0 security | All prod | E2E IP header could theoretically race before CF | `lib/network/ip.ts` | **cf-connecting-ip always wins**; adapter off in production |

Regression test: `tests/e2e/safari-install-prompt.spec.ts` (webkit-iphone).

## 5. Security: E2E IP adapter

Automated proofs in `tests/e2e/unit-ip-security.spec.ts`:

- Adapter **off** when `NODE_ENV=production` even if flag set  
- Adapter **off** when flag unset  
- `cf-connecting-ip` **overrides** `x-officepulse-e2e-ip`  
- Production ignores e2e header without CF  
- Local nonprod adapter works only without CF IP  

## 6. Punch / GEO authenticated UI

Server GEO matrix covered by `unit-validate.spec.ts` (always runs).  
UI punch against QA still needs `E2E_ALLOW_PUNCH=1` + QA service role for some admin paths; employee GPS/IP UI partially exercisable — **not claimed fully green for ATT punch mutations in this evidence pack**.

## 7. Real iPhone

**Not executed.** Checklist: `QA_REAL_IPHONE_CHECKLIST.md`.  
`E2E_REAL_IPHONE_PASS` was **not** set.

## 8. Release recommendation

| Gate | Status |
|---|---|
| Full matrix executed (5 browsers) | Yes |
| Zero failed P0 in baseline matrix | Yes (skips documented, not counted as pass) |
| Nonprod auth Chromium | Pass |
| Nonprod auth WebKit iPhone | Pass (after F1/F2) |
| IP adapter fail-closed | Pass |
| Real iPhone Safari + PWA | **Open** |
| Full ATT punch UI on all browsers | **Open** |
| `E2E_REQUIRE_AUTH=1` CI enforcement | Ready, not enabled in local |

### Explicit recommendation

**Do not release Safari / declare production-ready.**  
Ship the InstallPrompt + hydration fixes to nonprod/prod as **compatibility hardening**, then complete `QA_REAL_IPHONE_CHECKLIST.md` and remaining punch UI evidence.
