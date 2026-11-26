-- CoursePulse teacher Notification Center.
-- Add private teacher alerts for anonymous submissions and instructor-side reminders.
alter table public.teacher_notifications
  drop constraint if exists teacher_notifications_category_check;

alter table public.teacher_notifications
  add constraint teacher_notifications_category_check
  check (category in (
    'PERFORMANCE_REVIEW',
    'GENERAL',
    'NEW_FEEDBACK',
    'PENDING_FEEDBACK',
    'DEADLINE_ALERT'
  ));

grant delete on public.teacher_notifications to authenticated;

drop policy if exists teacher_notifications_instructor_reminder_insert on public.teacher_notifications;
create policy teacher_notifications_instructor_reminder_insert
  on public.teacher_notifications
  for insert
  to authenticated
  with check (
    recipient_id = (select auth.uid())
    and created_by = (select auth.uid())
    and category in ('PENDING_FEEDBACK', 'DEADLINE_ALERT')
    and organization_id = (select private.current_organization_id())
    and (select private.current_app_role()) = 'INSTRUCTOR'::public.app_role
  );

drop policy if exists teacher_notifications_recipient_delete on public.teacher_notifications;
create policy teacher_notifications_recipient_delete
  on public.teacher_notifications
  for delete
  to authenticated
  using (
    recipient_id = (select auth.uid())
    and (select private.current_app_role()) = 'INSTRUCTOR'::public.app_role
  );

create or replace function private.guard_teacher_notification_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recipient_id is distinct from old.recipient_id
     or new.created_by is distinct from old.created_by
     or new.category is distinct from old.category
     or new.period_start is distinct from old.period_start
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.organization_id is distinct from old.organization_id then
    raise exception 'Notification content is immutable';
  end if;
  if old.category = 'NEW_FEEDBACK'::text
     and new.created_at is distinct from old.created_at then
    if new.created_at <= old.created_at or new.read_at is not null then
      raise exception 'Invalid feedback notification refresh';
    end if;
    return new;
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'Notification creation time is immutable';
  end if;
  if old.read_at is not null and new.read_at is null then
    raise exception 'Read notifications cannot be marked unread';
  end if;
  return new;
end;
$$;

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
    do update set created_at = excluded.created_at, read_at = null;
  end loop;
  return new;
end;
$$;

revoke all on function private.notify_instructors_of_anonymous_feedback() from public, anon, authenticated;

drop trigger if exists anonymous_feedback_teacher_notification on public.anonymous_submissions;
create trigger anonymous_feedback_teacher_notification
  after insert on public.anonymous_submissions
  for each row
  execute function private.notify_instructors_of_anonymous_feedback();

comment on function private.notify_instructors_of_anonymous_feedback() is
  'Creates a generic daily instructor alert after an anonymous feedback response; never stores student identities or answer content.';
