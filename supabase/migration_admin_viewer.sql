-- ADMIN_VIEWER: read-only access to the full admin area.

alter table employees drop constraint if exists employees_role_check;
alter table employees
  add constraint employees_role_check
  check (role in ('ADMIN', 'ADMIN_VIEWER', 'EMPLOYEE'));

-- Full admin (writes)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees
    where auth_user_id = auth.uid()
      and role = 'ADMIN'
      and status = 'ACTIVE'
  );
$$;

-- Admin + viewer (reads)
create or replace function public.is_admin_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees
    where auth_user_id = auth.uid()
      and role in ('ADMIN', 'ADMIN_VIEWER')
      and status = 'ACTIVE'
  );
$$;

drop policy if exists "Employees can read own profile" on employees;
create policy "Employees can read own profile"
  on employees for select
  using (auth_user_id = auth.uid() or public.is_admin_staff());

drop policy if exists "Employees read own attendance" on attendance;
create policy "Employees read own attendance"
  on attendance for select
  using (
    employee_id = (select id from employees where auth_user_id = auth.uid())
    or public.is_admin_staff()
  );

drop policy if exists "Admins read audit logs" on audit_logs;
create policy "Admins read audit logs"
  on audit_logs for select
  using (public.is_admin_staff());
