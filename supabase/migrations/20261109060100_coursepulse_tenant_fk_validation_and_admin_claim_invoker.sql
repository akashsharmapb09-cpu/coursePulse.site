-- Validate the tenant composite foreign keys after the legacy single-tenant backfill.
-- The rollout preflight confirmed zero mismatched existing rows on both environments.
alter table public.courses validate constraint courses_instructor_org_fkey;
alter table public.courses validate constraint courses_department_org_fkey;
alter table public.courses validate constraint courses_semester_org_fkey;
alter table public.feedback validate constraint feedback_course_org_fkey;
alter table public.feedback validate constraint feedback_creator_org_fkey;
alter table public.course_enrollments validate constraint course_enrollments_course_org_fkey;
alter table public.course_enrollments validate constraint course_enrollments_student_org_fkey;
alter table public.course_enrollments validate constraint course_enrollments_enrolled_by_org_fkey;
alter table public.instructor_course_assignments validate constraint instructor_assignment_course_org_fkey;
alter table public.instructor_course_assignments validate constraint instructor_assignment_instructor_org_fkey;
alter table public.instructor_course_assignments validate constraint instructor_assignment_assigner_org_fkey;
alter table public.responses validate constraint responses_feedback_org_fkey;
alter table public.responses validate constraint responses_student_org_fkey;
alter table public.anonymous_submissions validate constraint anonymous_submissions_feedback_org_fkey;
alter table private.feedback_eligibility validate constraint feedback_eligibility_feedback_org_fkey;
alter table private.feedback_eligibility validate constraint feedback_eligibility_student_org_fkey;
alter table public.student_suggestions validate constraint student_suggestions_student_org_fkey;
alter table public.student_suggestions validate constraint student_suggestions_course_org_fkey;
alter table public.teacher_notifications validate constraint teacher_notifications_recipient_org_fkey;
alter table public.teacher_notifications validate constraint teacher_notifications_creator_org_fkey;
alter table public.student_directory validate constraint student_directory_department_org_fkey;

-- Keep the exposed RPC as an invoker wrapper; all privileged work and checks
-- are confined to the private function, which validates the caller and rate limit.
create or replace function public.admin_claim_setup_workspace(p_code text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.claim_setup_workspace(p_code)
$$;
revoke all on function public.admin_claim_setup_workspace(text) from public, anon;
grant execute on function public.admin_claim_setup_workspace(text) to authenticated;
