-- Office Attendance System schema
-- Run this in the Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  grace_minutes integer not null default 15,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text unique not null,
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  name text not null,
  mobile text not null unique,
  designation text not null,
  shift_id uuid references shifts(id),
  role text not null default 'EMPLOYEE' check (role in ('ADMIN', 'EMPLOYEE')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists office_settings (
  id uuid primary key default gen_random_uuid(),
  office_name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  allowed_radius_meters integer not null default 150,
  office_public_ip text,
  allowed_office_ips text[] not null default '{}',
  max_gps_accuracy_meters integer not null default 100,
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  attendance_date date not null,
  check_in_time timestamptz,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_in_accuracy double precision,
  check_in_distance_meters double precision,
  check_in_ip text,
  check_out_time timestamptz,
  check_out_latitude double precision,
  check_out_longitude double precision,
  check_out_accuracy double precision,
  check_out_distance_meters double precision,
  check_out_ip text,
  total_work_minutes integer,
  is_late boolean not null default false,
  is_early_leave boolean not null default false,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'ABSENT', 'CORRECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references employees(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  reason text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_date on attendance (attendance_date);
create index if not exists idx_attendance_employee on attendance (employee_id);
create index if not exists idx_employees_auth on employees (auth_user_id);
create index if not exists idx_employees_status on employees (status);
create index if not exists idx_audit_created on audit_logs (created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists employees_updated_at on employees;
create trigger employees_updated_at
  before update on employees
  for each row execute function set_updated_at();

drop trigger if exists office_settings_updated_at on office_settings;
create trigger office_settings_updated_at
  before update on office_settings
  for each row execute function set_updated_at();

drop trigger if exists attendance_updated_at on attendance;
create trigger attendance_updated_at
  before update on attendance
  for each row execute function set_updated_at();

-- Seed default morning shift
insert into shifts (name, start_time, end_time, grace_minutes, status)
select 'Morning', '09:00', '18:00', 15, 'ACTIVE'
where not exists (select 1 from shifts where name = 'Morning');

-- Seed placeholder office settings (update via Admin Settings)
insert into office_settings (
  office_name, address, latitude, longitude,
  allowed_radius_meters, office_public_ip, max_gps_accuracy_meters, timezone
)
select
  'Main Office',
  'Update this address',
  24.860700,
  67.001100,
  150,
  null,
  100,
  'Asia/Karachi'
where not exists (select 1 from office_settings);

-- Row Level Security
alter table shifts enable row level security;
alter table employees enable row level security;
alter table office_settings enable row level security;
alter table attendance enable row level security;
alter table audit_logs enable row level security;

-- Helper: current employee row
create or replace function public.current_employee()
returns employees
language sql
stable
security definer
set search_path = public
as $$
  select * from employees where auth_user_id = auth.uid() limit 1;
$$;

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

-- Employees policies
create policy "Employees can read own profile"
  on employees for select
  using (auth_user_id = auth.uid() or public.is_admin());

create policy "Admins can insert employees"
  on employees for insert
  with check (public.is_admin());

create policy "Admins can update employees"
  on employees for update
  using (public.is_admin());

-- Shifts
create policy "Authenticated can read shifts"
  on shifts for select
  to authenticated
  using (true);

create policy "Admins manage shifts"
  on shifts for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office settings
create policy "Authenticated can read office settings"
  on office_settings for select
  to authenticated
  using (true);

create policy "Admins manage office settings"
  on office_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Attendance
create policy "Employees read own attendance"
  on attendance for select
  using (
    employee_id = (select id from employees where auth_user_id = auth.uid())
    or public.is_admin()
  );

create policy "Employees insert own attendance"
  on attendance for insert
  with check (
    employee_id = (select id from employees where auth_user_id = auth.uid())
  );

create policy "Employees update own attendance"
  on attendance for update
  using (
    employee_id = (select id from employees where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Audit logs (admin only)
create policy "Admins read audit logs"
  on audit_logs for select
  using (public.is_admin());

create policy "Admins insert audit logs"
  on audit_logs for insert
  with check (public.is_admin());
