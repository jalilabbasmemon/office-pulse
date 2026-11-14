-- SEC-F-001 / SEC-002 Wave 0
-- Attendance writes are API-only (service role after server validation).
-- Employees retain SELECT on own rows. Admins may UPDATE via is_admin() JWT
-- (admin correction API) or via service role.
--
-- APPLY: nonproduction first (officepulse-qa). Production only after explicit approval.
-- ROLLBACK: see SEC_002_ROLLBACK_PLAN.md (restore insert/update employee policies).

-- 1) Remove employee write bypass
drop policy if exists "Employees insert own attendance" on public.attendance;
drop policy if exists "Employees update own attendance" on public.attendance;

-- 2) Explicit admin-only UPDATE (corrections). No employee INSERT/UPDATE/DELETE.
drop policy if exists "Admins update attendance" on public.attendance;
create policy "Admins update attendance"
  on public.attendance
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- 3) Defense in depth: no authenticated DELETE on attendance
drop policy if exists "Admins delete attendance" on public.attendance;
-- (intentionally no DELETE policy — hard deletes go through service role admin flows only)

-- 4) Ensure SELECT policies remain (own + admin staff) — recreate if missing
drop policy if exists "Employees read own attendance" on public.attendance;
create policy "Employees read own attendance"
  on public.attendance
  for select
  using (
    employee_id = (select id from public.employees where auth_user_id = auth.uid())
    or public.is_admin_staff()
  );

comment on table public.attendance is
  'SEC-002: writes via server service role (punch) or admin JWT update policy (correction). No employee INSERT/UPDATE.';
