-- After creating an Auth user in Supabase Dashboard (Authentication → Users → Add user),
-- replace the placeholders below and run this in the SQL editor to promote them to admin.
--
-- 1. Create user: admin@yourcompany.com / strong-password (auto-confirm)
-- 2. Copy the user's UUID from Authentication → Users
-- 3. Run:

/*
insert into employees (
  employee_id,
  auth_user_id,
  name,
  mobile,
  designation,
  shift_id,
  role,
  status
)
values (
  'ADM001',
  'PASTE-AUTH-USER-UUID-HERE',
  'Office Admin',
  '03000000000',
  'Administrator',
  (select id from shifts where name = 'Morning' limit 1),
  'ADMIN',
  'ACTIVE'
);
*/
