-- Keep the private eligibility ledger unreadable through the Data API.
-- RLS policies use this narrow SECURITY DEFINER predicate instead of querying
-- the private table as the authenticated caller.
create or replace function private.has_consumed_feedback_eligibility(p_feedback_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1
      from private.feedback_eligibility e
      where e.feedback_id = p_feedback_id
        and e.student_id = (select auth.uid())
        and e.consumed = true
    ),
    false
  )
$$;
revoke all on function private.has_consumed_feedback_eligibility(uuid) from public, anon, authenticated;
grant execute on function private.has_consumed_feedback_eligibility(uuid) to authenticated;

drop policy if exists feedback_select_scoped on public.feedback;
create policy feedback_select_scoped on public.feedback for select to authenticated
using (
  (select private.is_admin())
  or (select private.is_course_owner(course_id))
  or (
    (select private.current_app_role()) = 'STUDENT'::public.app_role
    and exists (
      select 1 from public.course_enrollments e
      where e.course_id = feedback.course_id
        and e.student_id = (select auth.uid())
    )
    and exists (
      select 1 from public.courses c
      where c.id = feedback.course_id
        and c.status = 'PUBLISHED'::public.course_status
    )
    and (
      is_open = true
      or (select private.has_consumed_feedback_eligibility(id))
    )
  )
);
