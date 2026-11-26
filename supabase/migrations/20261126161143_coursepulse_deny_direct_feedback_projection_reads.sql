-- Prevent direct PostgREST reads of the anonymous projection. Filtered access
-- is provided through the security-invoker wrapper for the private query RPC.
revoke all on table public.feedback_submissions from public, anon, authenticated, service_role;
drop policy if exists feedback_submissions_instructor_read on public.feedback_submissions;
drop policy if exists feedback_submissions_deny_api on public.feedback_submissions;
create policy feedback_submissions_deny_api on public.feedback_submissions
for all to anon, authenticated using (false) with check (false);
