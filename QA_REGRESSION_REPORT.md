# OfficePulse — QA Regression Report (through SEC-004)

**Date:** 2026-11-14  
**Recommendation:** **NO-GO** for production. Unblock QA server secret → re-run authorized punch matrix → then decide emergency hotfix vs Safari gate separately.

## Executive summary

| Item | Result |
|------|--------|
| Auth + WebKit iPhone + IP units + viewer rejection | **39 passed / 1 skipped / 0 failed** |
| Authorized punch success matrix | **Blocked** — local/Worker missing officepulse-qa `SUPABASE_SECRET_KEY` (500 Invalid API key) |
| Playwright needs privileged key for punches? | **No** (corrected in SEC-004) |
| Production DB mutated? | **No** |
| Real iPhone sign-off | **Pending** |
| Clean RC commit | See `SEC_004_RELEASE_GATE_REPORT.md` |

## SEC-004 harness note

Tests log in as disposable users and call normal APIs. Server-side secret stays on Next/QA Worker. Optional `.env.qa.local` is for the app process + Node day-reset fixture only.

Setup: `docs/QA_WORKER_SECRET_SETUP.md`.

## Remaining blockers

1. Place QA Supabase secret on local Next (`.env.qa.local`) and/or `office-pulse-qa` Worker.  
2. Re-run `tests/e2e/security-punch-matrix.spec.ts` to **0 failed**.  
3. Human `QA_REAL_IPHONE_CHECKLIST.md` before Safari compatibility claim.  
4. Production backup/PITR before any hotfix.
