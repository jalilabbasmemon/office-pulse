# SEC-002 Database Migration Review

## Migration

**File:** `supabase/migration_attendance_writes_api_only.sql`  
**Name (applied on QA):** `attendance_writes_api_only`  
**Target applied:** `officepulse-qa` (`hlcwsnhhmgjuxpebycyg`) — **2026-11-14**  
**Production:** NOT APPLIED

## Intent

Eliminate SEC-F-001: authenticated employees must not INSERT/UPDATE attendance via PostgREST using the publishable key.

## Changes

1. `DROP` policies:
   - `"Employees insert own attendance"`
   - `"Employees update own attendance"`
2. `CREATE` `"Admins update attendance"` — `using/with check (is_admin())`
3. Recreate `"Employees read own attendance"` (SELECT own + admin staff)
4. No employee DELETE policy (service-role admin flows only)

## Application code dependency

Punch APIs must use `createServiceClient()` **after** auth + GPS/IP + state checks (implemented).  
Admin correction uses `requireAdmin()` then service-role update + audit log.

## Rollback

See `SEC_002_ROLLBACK_PLAN.md` — restore prior insert/update policies only if emergency; prefer forward fix.

## Review checklist

- [x] Additive / reviewed SQL file in repo  
- [x] Applied on nonprod first  
- [ ] Applied on production (blocked — needs approval)  
- [x] Negative RLS tests on nonprod  
- [ ] Positive API punch with QA service role in CI  
