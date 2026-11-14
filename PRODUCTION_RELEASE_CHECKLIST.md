# OfficePulse — Production Release Checklist

**Updated:** 2026-11-14 (SEC-004)  
**Current verdict:** **NO-GO**

---

## Two separate release decisions (recommended)

| Decision | When |
|----------|------|
| **A. Emergency security hotfix** (Worker service-role + restrictive RLS) | After QA authorized punch matrix is **green** — Safari human sign-off **not** required for this hotfix |
| **B. Safari compatibility claim** | After `QA_REAL_IPHONE_CHECKLIST.md` human sign-off |

Production deploy of either still needs **explicit Jalil approval**.

---

## Mandatory gates

| # | Gate | Status |
|---|------|--------|
| G1 | Zero Critical / High app findings | **PASS** (overrides; residual moderate OpenNext documented) |
| G2 | RLS denies direct attendance writes (QA) | **PASS** |
| G3 | Unauthorized / viewer / inactive / force-pw | **PASS** |
| G4 | Authorized check-in/out + admin correction | **FAIL** — QA server secret pending |
| G5 | Production adapters off (`APP_ENV=production`) | **PASS** in config/unit |
| G6 | Real iPhone Safari/PWA | **Pending** (blocks claim B only) |
| G7 | Clean release commit | See `SEC_004_RELEASE_GATE_REPORT.md` |
| G8 | Backup/PITR verified | **OPEN** (required before prod hotfix) |

**Overall production:** **NO-GO** until G4 (+ G8 for hotfix).

---

## Pre-hotfix sequence (when G4 green)

Follow `SEC_002_DEPLOYMENT_PLAN.md`: backup → maintenance → **live Worker first** → RLS migration → negatives → punch/admin/export smokes.  
Do **not** treat `office-pulse-qa` deploy as production.
