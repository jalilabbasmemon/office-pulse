-- Per-branch public IPs for Wi‑Fi-only punch.
-- Location A can have IP A; Location B can have IP B.
-- Org-level office_settings.allowed_office_ips remains as optional shared fallback.

alter table office_locations
  add column if not exists allowed_public_ips text[] not null default '{}';

comment on column office_locations.allowed_public_ips is
  'Public egress IPs for this branch Wi‑Fi. Matched for wifi-only punch and labeled with this location name.';
