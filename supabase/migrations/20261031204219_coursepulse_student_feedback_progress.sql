-- Student completion state is derived from the private one-time eligibility ledger.
-- No answer rows or anonymous submission identifiers are exposed to students.
create or replace function private.get_student_feedback_status()
returns table(feedback_id uuid, submitted boolean)
language sql stable security definer set search_path = ''
as $$
  select f.id, coalesce(e.consumed,false)
  from public.feedback f
  join public.courses c on c.id=f.course_id
  join public.course_enrollments ce on ce.course_id=c.id and ce.student_id=(select auth.uid())
  left join private.feedback_eligibility e on e.feedback_id=f.id and e.student_id=(select auth.uid())
  where c.status='PUBLISHED'::public.course_status
    and private.current_app_role()='STUDENT'::public.app_role
$$;
revoke all on function private.get_student_feedback_status() from public,anon,authenticated;
grant execute on function private.get_student_feedback_status() to authenticated;

create or replace function public.get_student_feedback_status()
returns table(feedback_id uuid, submitted boolean)
language sql stable set search_path = ''
as $$ select * from private.get_student_feedback_status() $$;
revoke all on function public.get_student_feedback_status() from public,anon;
grant execute on function public.get_student_feedback_status() to authenticated;
