-- Make the intentional deny-by-default RLS posture explicit to advisors
-- and index the eligibility foreign key for future cleanup and lookup paths.
create policy anonymous_submissions_deny_direct_access
on public.anonymous_submissions
for all to anon, authenticated
using (false)
with check (false);

create policy feedback_eligibility_deny_direct_access
on private.feedback_eligibility
for all to anon, authenticated
using (false)
with check (false);

create index feedback_eligibility_student_idx
on private.feedback_eligibility(student_id);
