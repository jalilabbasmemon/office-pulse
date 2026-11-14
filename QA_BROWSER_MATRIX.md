# OfficePulse — Browser QA Matrix

**Updated:** 2026-11-14 (QA-002)  
**Automation:** `tests/e2e/`, `playwright.config.ts`  
**Projects:** `chromium-desktop`, `firefox-desktop`, `webkit-desktop`, `webkit-iphone`, `chromium-android`

## Rule

Skipped tests are **not** passes. Release CI should set `E2E_REQUIRE_AUTH=1` so missing P0 fixtures **fail**.  
WebKit green ≠ Safari certified. Real iPhone checklist: `QA_REAL_IPHONE_CHECKLIST.md`.

## Platforms

| Platform | Automation | Manual device smoke |
|---|---|---|
| Windows Chrome | chromium-desktop | Chrome |
| Firefox | firefox-desktop | Optional |
| Desktop Safari / WebKit | webkit-desktop | macOS Safari required |
| iPhone Safari | webkit-iphone | **Real iPhone required** |
| Android Chrome | chromium-android | Real Android optional |

## Latest baseline (no creds)

All 5 projects: **112 passed / 163 skipped / 0 failed** — see `QA_002_TEST_EVIDENCE.md` §3 for skip taxonomy.

## Nonprod auth (officepulse-qa)

| Suite | chromium-desktop | webkit-iphone |
|---|---|---|
| AUTH-001…007 + admin | Pass | Pass (after QA002-F1/F2) |
| Install-prompt regression | n/a | Pass |
| IP adapter unit | Pass | Pass |

## Scenario map (abbrev.)

| ID | Automation | Notes |
|---|---|---|
| AUTH-* | `auth.spec.ts` | Nonprod fixtures |
| GEO-001…010 | `unit-validate` + `geo-attendance` | Server always; UI needs punch flag |
| GEO-007 | `geo-attendance` + gesture UX | webkit-iphone |
| ADMIN/REPORT | `admin-reports.spec.ts` | Needs admin/viewer |
| PWA/UI | `public-smoke`, `pwa-ui-safari` | |
| Install overlay | `safari-install-prompt.spec.ts` | Regression QA002-F1 |
| IP security | `unit-ip-security.spec.ts` | Fail-closed |
| Real iPhone | manual gate | Never auto-set |

## Commands

```bash
set PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright
set E2E_TRUSTED_IP_ADAPTER=1
npm run test:e2e

# Nonprod auth (override env — do not point at production)
set E2E_FORCE_WEBSERVER=1
set NEXT_PUBLIC_SUPABASE_URL=https://hlcwsnhhmgjuxpebycyg.supabase.co
# + publishable key + E2E_* accounts from seed
npx playwright test tests/e2e/auth.spec.ts --project=webkit-iphone
```
