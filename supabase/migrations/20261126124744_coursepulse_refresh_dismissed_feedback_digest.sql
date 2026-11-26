-- Re-assert the daily feedback digest refresh behavior.
-- This migration matches the second idempotent application on the connected database.
create or replace function private.notify_instructors_of_anonymous_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_course_instructor_id uuid;
  v_recipient_id uuid;
begin
  select f.course_id, c.instructor_id
    into v_course_id, v_course_instructor_id
  from public.feedback f
  join public.courses c
    on c.id = f.course_id
   and c.organization_id = f.organization_id
  where f.id = new.feedback_id
    and f.organization_id = new.organization_id;

  if v_course_id is null then return new; end if;

  for v_recipient_id in
    select distinct u.id
    from public.users u
    where u.organization_id = new.organization_id
      and u.role = 'INSTRUCTOR'::public.app_role
      and u.is_active = true
      and (
        u.id = v_course_instructor_id
        or exists (
          select 1 from public.instructor_course_assignments a
          where a.course_id = v_course_id
            and a.instructor_id = u.id
            and a.organization_id = new.organization_id
        )
      )
  loop
    insert into public.teacher_notifications (
      recipient_id, created_by, organization_id, category, period_start, title, body
    )
    values (
      v_recipient_id,
      v_recipient_id,
      new.organization_id,
      'NEW_FEEDBACK',
      current_date,
      'New anonymous feedback received',
      'A new anonymous response has been submitted for one of your courses. Open Analytics to review reportable aggregate trends. Student identities and individual answers remain private.'
    )
    on conflict (recipient_id, category, period_start)
    do update set
      created_at = excluded.created_at,
      read_at = null,
      dismissed_at = null;
  end loop;
  return new;
end;
$$;