-- Normalized CoursePulse question catalogue and private duplicate tracker.
-- Existing users, feedback forms and sealed anonymous_submissions remain canonical.

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  feedback_id uuid references public.feedback(id) on delete cascade,
  answer_key text not null default gen_random_uuid()::text,
  label text not null check (char_length(btrim(label)) between 2 and 180),
  type text not null check (type in ('rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no')),
  order_index integer not null default 0,
  is_active boolean not null default true,
  is_required boolean not null default true,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  category text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_feedback_requires_course check (feedback_id is null or course_id is not null)
);
create unique index if not exists questions_form_answer_key_uq
  on public.questions (organization_id, feedback_id, answer_key) where feedback_id is not null;
create unique index if not exists questions_course_answer_key_uq
  on public.questions (organization_id, course_id, answer_key) where feedback_id is null and course_id is not null;
create unique index if not exists questions_global_answer_key_uq
  on public.questions (organization_id, answer_key) where feedback_id is null and course_id is null;
create index if not exists questions_scope_order_idx
  on public.questions (organization_id, course_id, feedback_id, is_active, order_index);

alter table public.questions enable row level security;
alter table public.questions force row level security;
revoke all on table public.questions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.questions to authenticated;

drop policy if exists questions_select_scoped on public.questions;
create policy questions_select_scoped on public.questions for select to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id)))
    or (
      private.current_app_role() = 'STUDENT'::public.app_role
      and is_active = true
      and exists (
        select 1
        from public.course_enrollments e
        join public.courses c on c.id = e.course_id and c.organization_id = e.organization_id
        where e.student_id = (select auth.uid())
          and e.organization_id = questions.organization_id
          and c.status = 'PUBLISHED'::public.course_status
          and (
            (questions.course_id is not null and c.id = questions.course_id)
            or (questions.course_id is null and questions.feedback_id is null)
          )
      )
    )
  )
);

drop policy if exists questions_insert_instructor on public.questions;
create policy questions_insert_instructor on public.questions for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and created_by = (select auth.uid())
  and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
  and (
    feedback_id is null
    or exists (
      select 1 from public.feedback f
      where f.id = questions.feedback_id and f.course_id = questions.course_id
        and f.organization_id = questions.organization_id
        and (private.is_admin() or private.is_course_owner(f.course_id))
    )
  )
);

drop policy if exists questions_update_instructor on public.questions;
create policy questions_update_instructor on public.questions for update to authenticated
using (
  organization_id = private.current_organization_id()
  and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
)
with check (
  organization_id = private.current_organization_id()
  and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
);

drop policy if exists questions_delete_instructor on public.questions;
create policy questions_delete_instructor on public.questions for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
);

-- Backfill existing JSON form questions without changing answer keys.
insert into public.questions (
  organization_id, course_id, feedback_id, answer_key, label, type,
  order_index, is_active, is_required, options, category, created_by
)
select
  f.organization_id, f.course_id, f.id, left(q.value->>'id', 120),
  left(btrim(q.value->>'label'), 180),
  case when q.value->>'type' in ('rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no')
    then q.value->>'type' else 'text' end,
  (q.ordinality - 1)::integer, true,
  coalesce((q.value->>'required')::boolean, true),
  case when jsonb_typeof(q.value->'options') = 'array' then q.value->'options' else '[]'::jsonb end,
  left(q.value->>'category', 80), f.created_by
from public.feedback f
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(f.form_schema) = 'array' then f.form_schema else '[]'::jsonb end
) with ordinality as q(value, ordinality)
where coalesce(q.value->>'id','') <> '' and coalesce(q.value->>'label','') <> ''
on conflict do nothing;

-- Safe profile projection. Underlying users RLS still applies to the caller.
create or replace view public.profiles with (security_invoker = true) as
select id, full_name, username, program as programme, lower(role::text) as role, organization_id
from public.users;
revoke all on public.profiles from public, anon;
grant select on public.profiles to authenticated;

-- Identity is stored only in this private duplicate-prevention table.
create table if not exists private.submission_tracker (
  student_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (student_id, course_id)
);
create index if not exists submission_tracker_org_course_idx
  on private.submission_tracker (organization_id, course_id, submitted_at);
alter table private.submission_tracker enable row level security;
alter table private.submission_tracker force row level security;
revoke all on table private.submission_tracker from public, anon, authenticated, service_role;

create or replace function private.track_anonymous_course_submission()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_student_id uuid := (select auth.uid());
  v_course_id uuid;
  v_organization_id uuid;
  v_inserted integer;
begin
  if v_student_id is null or private.current_app_role() <> 'STUDENT'::public.app_role then
    raise exception 'Only authenticated students can submit feedback' using errcode = '42501';
  end if;

  select f.course_id, f.organization_id into v_course_id, v_organization_id
  from public.feedback f
  join public.courses c on c.id = f.course_id and c.organization_id = f.organization_id
  join public.course_enrollments e on e.course_id = c.id and e.organization_id = c.organization_id
  where f.id = new.feedback_id and f.organization_id = private.current_organization_id()
    and e.student_id = v_student_id and f.is_open = true
    and c.status = 'PUBLISHED'::public.course_status;

  if v_course_id is null then
    raise exception 'Course feedback is unavailable to this student' using errcode = '42501';
  end if;

  insert into private.submission_tracker(student_id, course_id, organization_id)
  values (v_student_id, v_course_id, v_organization_id)
  on conflict (student_id, course_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'You have already submitted feedback for this course' using errcode = '23505';
  end if;
  return new;
end;
$function$;
revoke all on function private.track_anonymous_course_submission() from public, anon, authenticated, service_role;
drop trigger if exists anonymous_submissions_track_course_once on public.anonymous_submissions;
create trigger anonymous_submissions_track_course_once
before insert on public.anonymous_submissions
for each row execute function private.track_anonymous_course_submission();

create or replace function private.get_student_feedback_status()
returns table(feedback_id uuid, submitted boolean)
language sql stable security definer set search_path = ''
as $function$
  select f.id, coalesce(st.course_id is not null, e.consumed, false)
  from public.feedback f
  join public.courses c on c.id = f.course_id and c.organization_id = f.organization_id
  join public.course_enrollments ce on ce.course_id = c.id and ce.organization_id = c.organization_id
    and ce.student_id = (select auth.uid())
  left join private.submission_tracker st on st.student_id = (select auth.uid())
    and st.course_id = c.id and st.organization_id = f.organization_id
  left join private.feedback_eligibility e on e.feedback_id = f.id
    and e.student_id = (select auth.uid()) and e.organization_id = f.organization_id
  where f.organization_id = private.current_organization_id()
    and c.status = 'PUBLISHED'::public.course_status
    and private.current_app_role() = 'STUDENT'::public.app_role;
$function$;
revoke all on function private.get_student_feedback_status() from public, anon, authenticated, service_role;
grant execute on function private.get_student_feedback_status() to authenticated;

create or replace function private.sync_feedback_form_questions(p_feedback_id uuid, p_questions jsonb)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_course_id uuid;
  v_organization_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 30 then
    raise exception 'A form must contain between 1 and 30 questions' using errcode = '22023';
  end if;

  select f.course_id, f.organization_id into v_course_id, v_organization_id
  from public.feedback f
  where f.id = p_feedback_id and f.organization_id = private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(f.course_id))
  for update;
  if v_course_id is null then raise exception 'Feedback form not found or not editable' using errcode = '42501'; end if;

  delete from public.questions q where q.feedback_id = p_feedback_id and q.organization_id = v_organization_id;
  insert into public.questions(
    organization_id, course_id, feedback_id, answer_key, label, type,
    order_index, is_active, is_required, options, category, created_by
  )
  select
    v_organization_id, v_course_id, p_feedback_id, left(value->>'id', 120),
    left(btrim(value->>'label'), 180), value->>'type', (ordinality - 1)::integer,
    true, coalesce((value->>'required')::boolean, true),
    case when jsonb_typeof(value->'options')='array' then value->'options' else '[]'::jsonb end,
    left(value->>'category', 80), (select auth.uid())
  from jsonb_array_elements(p_questions) with ordinality as q(value, ordinality)
  where coalesce(value->>'id','') <> ''
    and char_length(btrim(coalesce(value->>'label',''))) between 2 and 180
    and value->>'type' in ('rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no');
  if not found then raise exception 'No valid questions were provided' using errcode = '22023'; end if;
end;
$function$;
revoke all on function private.sync_feedback_form_questions(uuid, jsonb) from public, anon;
grant execute on function private.sync_feedback_form_questions(uuid, jsonb) to authenticated;

create or replace function private.sync_question_catalog_to_feedback(p_course_id uuid default null)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := private.current_organization_id();
  v_form record;
  v_schema jsonb;
  v_count integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor access required' using errcode = '42501';
  end if;
  if p_course_id is not null and not (private.is_admin() or private.is_course_owner(p_course_id)) then
    raise exception 'Course is not assigned to this instructor' using errcode = '42501';
  end if;

  for v_form in
    select f.id, f.course_id from public.feedback f
    where f.organization_id = v_org and (p_course_id is null or f.course_id = p_course_id)
      and (private.is_admin() or private.is_course_owner(f.course_id))
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', catalog.answer_key, 'label', catalog.label, 'type', catalog.type,
      'required', catalog.is_required, 'options', catalog.options, 'category', catalog.category
    ) order by catalog.order_index, catalog.answer_key), '[]'::jsonb)
    into v_schema
    from (
      select distinct on (q.answer_key) q.*
      from public.questions q
      where q.organization_id = v_org and q.is_active = true
        and (q.feedback_id = v_form.id
          or (q.feedback_id is null and q.course_id = v_form.course_id)
          or (q.feedback_id is null and q.course_id is null))
      order by q.answer_key,
        case when q.feedback_id = v_form.id then 1 when q.course_id = v_form.course_id then 2 else 3 end,
        q.order_index
    ) catalog;

    if jsonb_array_length(v_schema) > 0 then
      update public.feedback set form_schema = v_schema, updated_at = now()
      where id = v_form.id and organization_id = v_org;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;
revoke all on function private.sync_question_catalog_to_feedback(uuid) from public, anon;
grant execute on function private.sync_question_catalog_to_feedback(uuid) to authenticated;

-- This initial safe shape is replaced in the next migration by a table populated
-- from a de-identified database trigger, avoiding a privileged view over answers.
create or replace view public.feedback_submissions as
with response_groups as (
  select a.id, a.feedback_id, f.course_id, c.course_code, c.title as course_title,
    c.semester_id, s.name as semester_name, f.title as feedback_title, a.received_on,
    a.answers, a.organization_id,
    count(*) over (partition by a.organization_id, a.feedback_id) as response_count
  from public.anonymous_submissions a
  join public.feedback f on f.id = a.feedback_id and f.organization_id = a.organization_id
  join public.courses c on c.id = f.course_id and c.organization_id = f.organization_id
  left join public.semesters s on s.id = c.semester_id and s.organization_id = c.organization_id
  where a.organization_id = private.current_organization_id()
    and private.current_app_role() in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role)
    and (private.is_admin() or private.is_course_owner(c.id))
),
effective_questions as (
  select r.id as submission_id, q.answer_key, q.label, q.type, q.order_index,
    r.answers -> q.answer_key as answer_value
  from response_groups r
  join public.questions q on q.organization_id = r.organization_id and q.is_active = true
    and (q.feedback_id = r.feedback_id
      or (q.feedback_id is null and q.course_id = r.course_id)
      or (q.feedback_id is null and q.course_id is null))
),
deduped_questions as (
  select distinct on (submission_id, answer_key) submission_id, answer_key, label, type, order_index, answer_value
  from effective_questions order by submission_id, answer_key, order_index
),
comment_rows as (
  select submission_id, string_agg(label || ': ' || (answer_value #>> '{}'), E'\n' order by order_index) as raw_comment
  from deduped_questions
  where type in ('text','textarea') and jsonb_typeof(answer_value) = 'string'
    and char_length(btrim(answer_value #>> '{}')) > 0
  group by submission_id
),
rating_rows as (
  select submission_id, coalesce(jsonb_object_agg(answer_key, answer_value), '{}'::jsonb) as ratings_json
  from deduped_questions where type = 'rating' and jsonb_typeof(answer_value) = 'number'
    and (answer_value #>> '{}') ~ '^[1-5]$'
  group by submission_id
)
select r.id, r.feedback_id, r.course_id, r.course_code, r.course_title, r.semester_id,
  r.semester_name, r.feedback_title, (r.received_on::timestamp at time zone 'UTC') as created_at,
  regexp_replace(regexp_replace(coalesce(c.raw_comment, ''),
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', '[redacted email]', 'gi'),
    '(\+?[0-9][0-9 ()-]{6,}[0-9])', '[redacted phone]', 'g') as comment,
  coalesce(rr.ratings_json, '{}'::jsonb) as ratings_json, r.response_count
from response_groups r
left join comment_rows c on c.submission_id = r.id
left join rating_rows rr on rr.submission_id = r.id
where r.response_count >= 5;
revoke all on public.feedback_submissions from public, anon;
grant select on public.feedback_submissions to authenticated;
