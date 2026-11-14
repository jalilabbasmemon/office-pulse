-- Multiple office / branch locations (GPS geofences).
-- Punch rules: office Wi‑Fi → GPS optional; other networks → must match a location.

create table if not exists office_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  allowed_radius_meters integer not null default 150
    check (allowed_radius_meters between 10 and 5000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists office_locations_active_idx
  on office_locations (is_active, sort_order);

drop trigger if exists office_locations_updated_at on office_locations;
create trigger office_locations_updated_at
  before update on office_locations
  for each row execute function public.set_updated_at();

alter table office_locations enable row level security;

drop policy if exists "Authenticated can read office locations" on office_locations;
create policy "Authenticated can read office locations"
  on office_locations for select
  to authenticated
  using (true);

drop policy if exists "Admins manage office locations" on office_locations;
create policy "Admins manage office locations"
  on office_locations for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed from existing single office_settings pin (if any)
insert into office_locations (name, address, latitude, longitude, allowed_radius_meters, is_active, sort_order)
select
  coalesce(nullif(trim(office_name), ''), 'Main Office'),
  address,
  latitude,
  longitude,
  allowed_radius_meters,
  true,
  0
from office_settings
where not exists (select 1 from office_locations)
limit 1;

-- Optional labels on attendance for which branch matched
alter table attendance
  add column if not exists check_in_location_name text,
  add column if not exists check_out_location_name text;
