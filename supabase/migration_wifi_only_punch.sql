-- Allow check-in/out on office Wi‑Fi when laptop GPS is unavailable
-- (Windows often reports a city IP location such as Islamabad).
alter table office_settings
  add column if not exists allow_wifi_only_punch boolean not null default true;

comment on column office_settings.allow_wifi_only_punch is
  'When true, matching office public IP is enough to punch; GPS geofence is optional (for desktops without GPS).';
