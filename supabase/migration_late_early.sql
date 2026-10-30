-- Run once in Supabase SQL Editor
alter table attendance
  add column if not exists is_late boolean not null default false;

alter table attendance
  add column if not exists is_early_leave boolean not null default false;
