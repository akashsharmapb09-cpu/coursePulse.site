alter table public.feedback add column if not exists due_at timestamptz;
comment on column public.feedback.due_at is 'Optional deadline after which eligible students cannot submit feedback.';

drop policy if exists feedback_select_scoped on public.feedback;
create policy feedback_select_scoped on public.feedback for select to authenticated
using (
  (select private.is_admin())
  or (select private.is_course_owner(course_id))
  or (
    (select private.current_app_role())='STUDENT'::public.app_role
    and exists(select 1 from public.course_enrollments e where e.course_id=feedback.course_id and e.student_id=(select auth.uid()))
    and exists(select 1 from public.courses c where c.id=feedback.course_id and c.status='PUBLISHED'::public.course_status)
    and (
      feedback.is_open=true
      or exists(select 1 from private.feedback_eligibility e where e.feedback_id=feedback.id and e.student_id=(select auth.uid()) and e.consumed=true)
    )
  )
);

create or replace function private.enforce_feedback_deadline()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_due_at timestamptz; v_open boolean; v_course_status public.course_status;
begin
  select f.due_at,f.is_open,c.status into v_due_at,v_open,v_course_status
  from public.feedback f join public.courses c on c.id=f.course_id
  where f.id=new.feedback_id;
  if not found or v_open is distinct from true or v_course_status is distinct from 'PUBLISHED'::public.course_status then
    raise exception 'Feedback form is closed or unavailable' using errcode='P0002';
  end if;
  if v_due_at is not null and now()>=v_due_at then
    raise exception 'Feedback submission deadline has passed' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_feedback_deadline() from public,anon,authenticated;
drop trigger if exists enforce_feedback_deadline on public.anonymous_submissions;
create trigger enforce_feedback_deadline before insert on public.anonymous_submissions
for each row execute function private.enforce_feedback_deadline();
