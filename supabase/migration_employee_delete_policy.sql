-- Allow admins to hard-delete employee rows (API also uses service role).
drop policy if exists "Admins can delete employees" on employees;
create policy "Admins can delete employees"
  on employees for delete
  using (public.is_admin());

-- Attendance rows block employee delete without cascade; keep history optional.
-- Soft-delete (INACTIVE) is preferred; hard delete removes attendance in the API.
