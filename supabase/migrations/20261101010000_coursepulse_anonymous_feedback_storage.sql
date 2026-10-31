-- Separate one-time student eligibility from the anonymous answer store.
-- No stable identifier or direct foreign key connects the two tables.
create table private.feedback_eligibility (
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  consumed boolean not null default false,
  primary key (feedback_id, student_id)
);
alter table private.feedback_eligibility enable row level security;
revoke all on table private.feedback_eligibility from public, anon, authenticated, service_role;

create table public.anonymous_submissions (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 32768),
  received_on date not null default current_date
);
create index anonymous_submissions_feedback_idx on public.anonymous_submissions(feedback_id);
create index anonymous_submissions_received_idx on public.anonymous_submissions(received_on);
alter table public.anonymous_submissions enable row level security;
revoke all on table public.anonymous_submissions from public, anon, authenticated, service_role;

-- Consume eligibility and insert answers in one transaction. The answer row
-- receives no student ID, eligibility ID, IP address or precise timestamp.
create or replace function private.submit_anonymous_feedback(p_feedback_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := (select auth.uid());
  v_claimed boolean;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if private.current_app_role() <> 'STUDENT'::public.app_role then
    raise exception 'Only students can submit feedback' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 32768 then
    raise exception 'Invalid answer payload' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.feedback f
    join public.courses c on c.id = f.course_id
    where f.id = p_feedback_id
      and f.is_open = true
      and c.status = 'PUBLISHED'::public.course_status
  ) then
    raise exception 'Feedback form is closed or unavailable' using errcode = 'P0002';
  end if;

  insert into private.feedback_eligibility(feedback_id, student_id)
  values (p_feedback_id, v_student_id)
  on conflict (feedback_id, student_id) do nothing;

  update private.feedback_eligibility
  set consumed = true
  where feedback_id = p_feedback_id
    and student_id = v_student_id
    and consumed = false
  returning true into v_claimed;

  if coalesce(v_claimed, false) = false then
    raise exception 'Feedback already submitted' using errcode = '23505';
  end if;

  insert into public.anonymous_submissions(feedback_id, answers)
  values (p_feedback_id, p_answers);
end;
$$;
revoke all on function private.submit_anonymous_feedback(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.submit_anonymous_feedback(uuid, jsonb) to authenticated;

create or replace function public.submit_anonymous_feedback(p_feedback_id uuid, p_answers jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.submit_anonymous_feedback(p_feedback_id, p_answers) $$;
revoke all on function public.submit_anonymous_feedback(uuid, jsonb) from public, anon;
grant execute on function public.submit_anonymous_feedback(uuid, jsonb) to authenticated;

-- Students can see only their legacy submission records. Administrators do
-- not receive raw-answer access; new answer rows have no identity mapping.
drop policy if exists responses_select_own_or_admin on public.responses;
create policy responses_select_own_only on public.responses
for select to authenticated
using (student_id = (select auth.uid()));

-- Continue legacy retention and apply the same per-form retention to new rows.
create or replace function public.cleanup_expired_responses()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_legacy bigint;
  deleted_anonymous bigint;
begin
  delete from public.responses r
  using public.feedback f
  where f.id = r.feedback_id
    and r.submitted_at < now() - make_interval(days => f.retention_days);
  get diagnostics deleted_legacy = row_count;

  delete from public.anonymous_submissions a
  using public.feedback f
  where f.id = a.feedback_id
    and a.received_on < (current_date - f.retention_days);
  get diagnostics deleted_anonymous = row_count;

  return deleted_legacy + deleted_anonymous;
end;
$$;
revoke all on function public.cleanup_expired_responses() from public, anon, authenticated;
grant execute on function public.cleanup_expired_responses() to service_role;

-- Aggregate both legacy and anonymous submissions through the same thresholded
-- reporting surface. Neither raw table is exposed to instructors/admins.
create or replace function private.get_instructor_aggregates(p_course_id uuid default null)
returns table (
  course_id uuid, course_title text, feedback_id uuid, feedback_title text,
  question_id text, question_label text, question_type text, option_value text,
  response_count bigint, avg_numeric_value numeric
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
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode = '42501';
  end if;

  return query
  with all_responses as (
    select r.id, r.feedback_id, r.answers from public.responses r
    union all
    select a.id, a.feedback_id, a.answers from public.anonymous_submissions a
  ), question_values as (
    select c.id as c_id, c.title as c_title, f.id as f_id, f.title as f_title,
      q.value->>'id' as q_id, q.value->>'label' as q_label,
      q.value->>'type' as q_type, r.id as response_id, a.answer_value
    from public.courses c
    join public.feedback f on f.course_id = c.id
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    left join all_responses r on r.feedback_id = f.id
    left join lateral (
      select jsonb_array_elements_text(r.answers->(q.value->>'id')) as answer_value
      where jsonb_typeof(r.answers->(q.value->>'id')) = 'array'
      union all
      select r.answers->>(q.value->>'id') as answer_value
      where r.answers ? (q.value->>'id')
        and jsonb_typeof(r.answers->(q.value->>'id')) <> 'array'
    ) a on true
    where (p_course_id is null or c.id = p_course_id)
      and (private.is_admin() or (private.is_instructor() and c.instructor_id = (select auth.uid())))
  ), normalised as (
    select q.*,
      case when q_type in ('text','textarea','long_text','rating','number') then null::text else answer_value end as grouped_option,
      case when q_type in ('rating','number') and answer_value ~ '^-?[0-9]+(\\.[0-9]+)?$'
        then answer_value::numeric else null::numeric end as numeric_answer
    from question_values q
  )
  select n.c_id, n.c_title, n.f_id, n.f_title, n.q_id, n.q_label, n.q_type,
    n.grouped_option, count(distinct n.response_id)::bigint,
    case when n.q_type in ('rating','number') then avg(n.numeric_answer) else null::numeric end
  from normalised n
  group by n.c_id, n.c_title, n.f_id, n.f_title, n.q_id, n.q_label, n.q_type, n.grouped_option
  having count(distinct n.response_id) >= 5;
end;
$$;
revoke all on function private.get_instructor_aggregates(uuid) from public, anon;
grant execute on function private.get_instructor_aggregates(uuid) to authenticated;
comment on table public.anonymous_submissions is 'Answer payloads stored without a student identifier or direct eligibility reference.';
comment on table private.feedback_eligibility is 'One-time eligibility ledger. Never joined to anonymous answer records.';
