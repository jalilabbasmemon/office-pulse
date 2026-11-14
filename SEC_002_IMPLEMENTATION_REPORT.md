# SEC-002 Implementation Report

**Date:** 2026-11-14  
**Scope:** Wave 0 (SEC-F-001…F-004) + adapter/middleware verification  
**Environment:** Nonproduction only (`officepulse-qa` / `hlcwsnhhmgjuxpebycyg`)  
**Production deploy:** **NOT PERFORMED — awaiting explicit approval**

## Summary

| Finding | Status | Notes |
|---------|--------|-------|
| SEC-F-001 Attendance RLS bypass | **FIXED** (nonprod verified) | Migration applied on QA; employee INSERT/UPDATE/DELETE denied via real Supabase client |
| SEC-F-002 Open redirect | **FIXED** + unit/e2e probes | `safeInternalPath` |
| SEC-F-003 Excel formula injection | **FIXED** + workbook parse test | ExcelJS + `asExcelText` |
| SEC-F-004 Vulnerable `xlsx` | **FIXED** (replaced) | `xlsx` removed; residual Highs are OpenNext/`glob`, not SheetJS |
| E2E IP adapter / SEC-F-005/F-010 | **FIXED** (unit) | Production fail-closed without CF IP |
| Middleware ACTIVE / must_change_password | **PARTIALLY VERIFIED** | Authz API tests; full browser force-pw needs stable QA webserver env |

## Changed files (code)

- `supabase/migration_attendance_writes_api_only.sql` (new)
- `supabase/schema.sql` (baseline policies)
- `app/api/attendance/check-in/route.ts` — service-role write after validation
- `app/api/attendance/check-out/route.ts` — same
- `app/api/admin/attendance/[id]/correct/route.ts` — service-role write after `requireAdmin`
- `app/api/admin/attendance/export/route.ts` — async ExcelJS
- `app/api/auth/callback/route.ts` — safe redirect
- `lib/auth/safe-redirect.ts` (new)
- `lib/excel/export.ts` — ExcelJS rewrite
- `lib/excel/sanitize.ts` (new)
- `lib/network/ip.ts` — production XFF fail-closed; APP_ENV gate
- `package.json` / lock — `exceljs`; `xlsx` removed
- Tests under `tests/e2e/unit-*.spec.ts`, `security-rls-attendance.spec.ts`, `security-authz.spec.ts`

## Database

- Nonprod migration **applied** to `hlcwsnhhmgjuxpebycyg`  
- Production migration **not applied**

## Test evidence (highlights)

```
security-rls-attendance + unit-safe-redirect + unit-excel-security + unit-ip-security
→ 19 passed (chromium-desktop) against officepulse-qa
```

- Employee INSERT denied  
- Employee UPDATE denied  
- Employee DELETE on visible row → 0 rows / row remains  
- Unauthenticated insert denied  
- Employee SELECT own rows OK  
- Formula cells forced to text in real XLSX  
- Open-redirect vectors rejected  

## Residual risks

1. **Authorized API punch success** on local Next against QA requires QA **service role** secret in env (not available via MCP). RLS denial side is verified; wire secret in CI for full punch round-trip.  
2. **npm audit** still reports High via `@opennextjs/cloudflare` → `glob` (unrelated to Wave 0 xlsx).  
3. **exceljs** pulls moderate advisory via deprecated `uuid` transitive — prefer monitoring; do not downgrade to 3.4.0.  
4. Production Supabase still has old employee write policies until approved migration.

## Request

Please review `SEC_002_DEPLOYMENT_PLAN.md` / `SEC_002_ROLLBACK_PLAN.md` and **explicitly approve** before any production Worker or production Supabase change.
