-- Student Voice and private teacher notifications. Forward-only; applies to isolated QA first.
create table public.student_suggestions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete restrict,
  category text not null check (category in ('INFRASTRUCTURE','CANTEEN','LIBRARY','TEACHING_QUALITY','LABS','OTHER')),
  title text not null check (char_length(btrim(title)) between 4 and 140),
  details text not null check (char_length(btrim(details)) between 10 and 4000),
  course_id uuid references public.courses(id) on delete set null,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','UNDER_REVIEW','IN_PROGRESS','RESOLVED')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_suggestions_student_created_idx on public.student_suggestions(student_id, created_at desc);
create index student_suggestions_status_created_idx on public.student_suggestions(status, created_at desc);
create index student_suggestions_course_idx on public.student_suggestions(course_id) where course_id is not null;

alter table public.student_suggestions enable row level security;
revoke all on public.student_suggestions from anon, authenticated;
grant select, insert on public.student_suggestions to authenticated;
grant update (status, resolution_note, reviewed_by, reviewed_at, updated_at) on public.student_suggestions to authenticated;

create policy student_suggestions_student_read
  on public.student_suggestions for select to authenticated
  using (student_id = (select auth.uid()) and (select private.current_app_role()) = 'STUDENT'::public.app_role);

create policy student_suggestions_admin_read
  on public.student_suggestions for select to authenticated
  using ((select private.is_admin()));

create policy student_suggestions_student_insert
  on public.student_suggestions for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select private.current_app_role()) = 'STUDENT'::public.app_role
    and (
      course_id is null
      or exists (
        select 1 from public.course_enrollments e
        where e.course_id = student_suggestions.course_id
          and e.student_id = (select auth.uid())
      )
    )
  );

create policy student_suggestions_admin_update
  on public.student_suggestions for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create or replace function private.guard_student_suggestion_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator MFA is required';
  end if;
  if new.student_id is distinct from old.student_id
     or new.category is distinct from old.category
     or new.title is distinct from old.title
     or new.details is distinct from old.details
     or new.course_id is distinct from old.course_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Suggestion content and ownership are immutable';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'RECEIVED' and new.status = 'UNDER_REVIEW')
    or (old.status = 'UNDER_REVIEW' and new.status in ('IN_PROGRESS','RESOLVED'))
    or (old.status = 'IN_PROGRESS' and new.status in ('UNDER_REVIEW','RESOLVED'))
  ) then
    raise exception 'Invalid suggestion status transition';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger student_suggestions_guard_update
before update on public.student_suggestions
for each row execute function private.guard_student_suggestion_update();

create table public.teacher_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  category text not null check (category in ('PERFORMANCE_REVIEW','GENERAL')),
  period_start date not null default (date_trunc('month', now())::date),
  title text not null check (char_length(btrim(title)) between 4 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 1200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint teacher_notifications_unique_period unique (recipient_id, category, period_start)
);

create index teacher_notifications_recipient_created_idx
  on public.teacher_notifications(recipient_id, created_at desc);

alter table public.teacher_notifications enable row level security;
revoke all on public.teacher_notifications from anon, authenticated;
grant select on public.teacher_notifications to authenticated;
grant insert on public.teacher_notifications to authenticated;
grant update (read_at) on public.teacher_notifications to authenticated;

create policy teacher_notifications_recipient_read
  on public.teacher_notifications for select to authenticated
  using (
    recipient_id = (select auth.uid())
    and (select private.current_app_role()) = 'INSTRUCTOR'::public.app_role
  );

create policy teacher_notifications_admin_insert
  on public.teacher_notifications for insert to authenticated
  with check (
    (select private.is_admin())
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = teacher_notifications.recipient_id
        and u.role = 'INSTRUCTOR'::public.app_role
        and u.is_active = true
    )
  );

create policy teacher_notifications_recipient_update
  on public.teacher_notifications for update to authenticated
  using (
    recipient_id = (select auth.uid())
    and (select private.current_app_role()) = 'INSTRUCTOR'::public.app_role
  )
  with check (
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
     or new.created_at is distinct from old.created_at then
    raise exception 'Notification content is immutable';
  end if;
  if old.read_at is not null and new.read_at is null then
    raise exception 'Read notifications cannot be marked unread';
  end if;
  return new;
end;
$$;

create trigger teacher_notifications_guard_update
before update on public.teacher_notifications
for each row execute function private.guard_teacher_notification_update();

comment on table public.student_suggestions is
  'Identified student-to-college suggestions; separate from anonymous feedback answer storage.';
comment on table public.teacher_notifications is
  'Private in-app notifications visible only to the addressed active instructor.';
