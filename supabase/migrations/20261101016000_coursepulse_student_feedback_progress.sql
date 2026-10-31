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
language sql stable security invoker set search_path = ''
as $$ select * from private.get_student_feedback_status() $$;
revoke all on function public.get_student_feedback_status() from public,anon;
grant execute on function public.get_student_feedback_status() to authenticated;

drop policy if exists feedback_select_scoped on public.feedback;
create policy feedback_select_scoped on public.feedback for select to authenticated
using (
  (select private.is_admin())
  or (select private.is_course_owner(course_id))
  or (
    (select private.current_app_role())='STUDENT'::public.app_role
    and exists(select 1 from public.course_enrollments e where e.course_id=feedback.course_id and e.student_id=(select auth.uid()))
    and exists(select 1 from public.courses c where c.id=feedback.course_id and c.status='PUBLISHED'::public.course_status)
  )
);
