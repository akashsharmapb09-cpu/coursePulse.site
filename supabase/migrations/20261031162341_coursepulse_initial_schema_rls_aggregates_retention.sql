
create type public.app_role as enum ('ADMIN', 'INSTRUCTOR', 'STUDENT');
create type public.course_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.app_role not null default 'STUDENT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  status public.course_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_instructor_idx on public.courses(instructor_id);
create index courses_status_idx on public.courses(status);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 3000),
  form_schema jsonb not null check (jsonb_typeof(form_schema) = 'array' and pg_column_size(form_schema) <= 32768),
  is_open boolean not null default true,
  retention_days integer not null default 365 check (retention_days between 30 and 730),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_course_idx on public.feedback(course_id);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 32768),
  submitted_at timestamptz not null default now(),
  unique(feedback_id, student_id)
);
create index responses_feedback_idx on public.responses(feedback_id);
create index responses_student_idx on public.responses(student_id);
create index responses_submitted_idx on public.responses(submitted_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger courses_set_updated_at before update on public.courses
for each row execute function public.set_updated_at();
create trigger feedback_set_updated_at before update on public.feedback
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    'STUDENT'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u where u.id = (select auth.uid()) limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'ADMIN'::public.app_role, false);
$$;

create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'INSTRUCTOR'::public.app_role, false);
$$;

create or replace function public.is_course_owner(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.instructor_id = (select auth.uid())
  ) and public.is_instructor();
$$;

grant usage on schema public to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_instructor() to authenticated;
grant execute on function public.is_course_owner(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.feedback enable row level security;
alter table public.responses enable row level security;

create policy users_select_self_or_admin on public.users
for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy users_update_own_profile on public.users
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
grant select on public.users to authenticated;
grant update (full_name) on public.users to authenticated;

create policy courses_select_scoped on public.courses
for select to authenticated
using (
  (select public.is_admin())
  or instructor_id = (select auth.uid())
  or (
    status = 'PUBLISHED'::public.course_status
    and (select public.current_app_role()) = 'STUDENT'::public.app_role
  )
);

create policy courses_insert_owner_or_admin on public.courses
for insert to authenticated
with check (
  (select public.is_admin())
  or (
    (select public.is_instructor())
    and instructor_id = (select auth.uid())
  )
);

create policy courses_update_owner_or_admin on public.courses
for update to authenticated
using (
  (select public.is_admin())
  or ((select public.is_instructor()) and instructor_id = (select auth.uid()))
)
with check (
  (select public.is_admin())
  or ((select public.is_instructor()) and instructor_id = (select auth.uid()))
);

create policy courses_delete_owner_or_admin on public.courses
for delete to authenticated
using (
  (select public.is_admin())
  or ((select public.is_instructor()) and instructor_id = (select auth.uid()))
);
grant select on public.courses to authenticated;
grant insert (instructor_id, title, description, status) on public.courses to authenticated;
grant update (title, description, status) on public.courses to authenticated;
grant delete on public.courses to authenticated;

create policy feedback_select_scoped on public.feedback
for select to authenticated
using (
  (select public.is_admin())
  or (select public.is_course_owner(course_id))
  or (
    is_open = true
    and (select public.current_app_role()) = 'STUDENT'::public.app_role
    and exists (
      select 1 from public.courses c
      where c.id = feedback.course_id
        and c.status = 'PUBLISHED'::public.course_status
    )
  )
);

create policy feedback_insert_course_owner on public.feedback
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select public.is_admin())
    or (select public.is_course_owner(course_id))
  )
);

create policy feedback_update_course_owner on public.feedback
for update to authenticated
using (
  (select public.is_admin()) or (select public.is_course_owner(course_id))
)
with check (
  (select public.is_admin()) or (select public.is_course_owner(course_id))
);

create policy feedback_delete_course_owner on public.feedback
for delete to authenticated
using (
  (select public.is_admin()) or (select public.is_course_owner(course_id))
);
grant select on public.feedback to authenticated;
grant insert (course_id, created_by, title, description, form_schema, is_open, retention_days) on public.feedback to authenticated;
grant update (title, description, form_schema, is_open, retention_days) on public.feedback to authenticated;
grant delete on public.feedback to authenticated;

create policy responses_select_own_or_admin on public.responses
for select to authenticated
using (
  student_id = (select auth.uid())
  or (select public.is_admin())
);

create policy responses_insert_self_only on public.responses
for insert to authenticated
with check (
  student_id = (select auth.uid())
  and (select public.current_app_role()) = 'STUDENT'::public.app_role
  and exists (
    select 1
    from public.feedback f
    join public.courses c on c.id = f.course_id
    where f.id = responses.feedback_id
      and f.is_open = true
      and c.status = 'PUBLISHED'::public.course_status
  )
);
grant select, insert on public.responses to authenticated;

create or replace function public.get_instructor_aggregates(p_course_id uuid default null)
returns table (
  course_id uuid,
  course_title text,
  feedback_id uuid,
  feedback_title text,
  question_id text,
  question_label text,
  question_type text,
  option_value text,
  response_count bigint,
  avg_numeric_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if public.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode = '42501';
  end if;

  return query
  with scoped as (
    select c.id as c_id, c.title as c_title, f.id as f_id, f.title as f_title,
           q.value as question, r.id as response_id, r.answers
    from public.courses c
    join public.feedback f on f.course_id = c.id
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    left join public.responses r on r.feedback_id = f.id
    where (p_course_id is null or c.id = p_course_id)
      and (
        public.is_admin()
        or (public.is_instructor() and c.instructor_id = (select auth.uid()))
      )
  ),
  values_by_question as (
    select s.c_id, s.c_title, s.f_id, s.f_title,
           s.question ->> 'id' as q_id,
           s.question ->> 'label' as q_label,
           s.question ->> 'type' as q_type,
           s.response_id,
           case when s.question ->> 'type' = 'text' then null else v.value end as option_value
    from scoped s
    left join lateral (
      select jsonb_array_elements_text(
        case
          when jsonb_typeof(s.answers -> (s.question ->> 'id')) = 'array'
            then s.answers -> (s.question ->> 'id')
          when s.answers ? (s.question ->> 'id')
               and jsonb_typeof(s.answers -> (s.question ->> 'id')) <> 'null'
            then jsonb_build_array(s.answers -> (s.question ->> 'id'))
          else '[]'::jsonb
        end
      ) as value
    ) v on true
  )
  select v.c_id, v.c_title, v.f_id, v.f_title, v.q_id, v.q_label, v.q_type,
         v.option_value,
         count(distinct v.response_id)::bigint,
         case
           when v.q_type in ('rating', 'number')
            and v.option_value ~ '^-?[0-9]+(\.[0-9]+)?$'
           then avg(v.option_value::numeric)
           else null::numeric
         end
  from values_by_question v
  group by v.c_id, v.c_title, v.f_id, v.f_title, v.q_id, v.q_label,
           v.q_type, v.option_value
  having count(distinct v.response_id) >= 5;
end;
$$;
revoke all on function public.get_instructor_aggregates(uuid) from public, anon;
grant execute on function public.get_instructor_aggregates(uuid) to authenticated;

create or replace function public.cleanup_expired_responses()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare deleted_count bigint;
begin
  delete from public.responses r
  using public.feedback f
  where f.id = r.feedback_id
    and r.submitted_at < now() - make_interval(days => f.retention_days);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.cleanup_expired_responses() from public, anon, authenticated;
grant execute on function public.cleanup_expired_responses() to service_role;

comment on table public.users is 'Application profile and server-assigned role. Role cannot be self-updated.';
comment on table public.courses is 'Instructor-owned courses. RLS limits instructors to their own courses.';
comment on table public.feedback is 'Feedback forms attached to courses.';
comment on table public.responses is 'Student answers. Instructors have no SELECT policy; use aggregate RPC only.';
comment on function public.get_instructor_aggregates(uuid) is 'Aggregate-only export source. Suppresses option groups with fewer than five responses and never returns free-text answers.';
comment on function public.cleanup_expired_responses() is 'Deletes responses beyond each feedback form retention period. Invoke only from trusted server cron.';
