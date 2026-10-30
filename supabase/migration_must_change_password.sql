-- Run once in Supabase SQL Editor
alter table employees
  add column if not exists must_change_password boolean not null default false;

-- Existing seeded admin should not be forced
update employees
set must_change_password = false
where employee_id = 'ADM001';
