-- Run in Supabase SQL Editor as a trusted project administrator.
-- Replace the email and role with a real, already-registered account.
-- Valid roles: ADMIN, INSTRUCTOR, STUDENT.
update public.users
set role = 'INSTRUCTOR'::public.app_role
where lower(email) = lower('instructor@example.edu');

-- For the first administrator, run only after verifying the account identity:
-- update public.users set role = 'ADMIN'::public.app_role
-- where lower(email) = lower('admin@example.edu');
