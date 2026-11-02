alter table public.anonymous_submissions add column if not exists submitted_at timestamptz not null default now();
create index if not exists anonymous_submissions_submitted_at_idx on public.anonymous_submissions(submitted_at desc);

do $$
declare
  v_definition text;
  v_old text;
begin
  select pg_get_functiondef('private.get_instructor_aggregates(uuid)'::regprocedure) into v_definition;

  v_old := 'private.get_instructor_aggregates(p_course_id uuid DEFAULT NULL::uuid)';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate source aggregate function signature'; end if;
  v_definition := replace(v_definition,v_old,'private.get_instructor_aggregates_filtered(p_course_id uuid DEFAULT NULL::uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_semester_id uuid DEFAULT NULL::uuid)');

  v_old := 'select r.id, r.feedback_id, r.answers from public.responses r
    union all
    select a.id, a.feedback_id, a.answers from public.anonymous_submissions a';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate aggregate response union'; end if;
  v_definition := replace(v_definition,'select r.id, r.feedback_id, r.answers from public.responses r
    union all
    select a.id, a.feedback_id, a.answers from public.anonymous_submissions a',
  'select r.id, r.feedback_id, r.answers, r.submitted_at::date as submitted_on from public.responses r
    union all
    select a.id, a.feedback_id, a.answers, a.submitted_at::date as submitted_on from public.anonymous_submissions a');

  v_old := 'q.value->>''type'' as q_type, r.id as response_id, a.answer_value';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate aggregate question projection'; end if;
  v_definition := replace(v_definition,v_old,'q.value->>''type'' as q_type, r.id as response_id, r.submitted_on, a.answer_value');

  v_old := 'where (p_course_id is null or c.id = p_course_id)
      and (private.is_admin() or (private.is_instructor() and private.is_course_owner(c.id)))';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate aggregate filters'; end if;
  v_definition := replace(v_definition,v_old,'where (p_course_id is null or c.id = p_course_id)
      and (p_from_date is null or r.submitted_on >= p_from_date)
      and (p_to_date is null or r.submitted_on <= p_to_date)
      and (p_semester_id is null or c.semester_id = p_semester_id)
      and (private.is_admin() or (private.is_instructor() and private.is_course_owner(c.id)))');

  execute v_definition;
end;
$$;

revoke all on function private.get_instructor_aggregates_filtered(uuid,date,date,uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_aggregates_filtered(uuid,date,date,uuid) to authenticated;

create or replace function public.get_instructor_aggregates_filtered(
  p_course_id uuid default null,
  p_from_date date default null,
  p_to_date date default null,
  p_semester_id uuid default null
)
returns table(
  course_id uuid, course_title text, feedback_id uuid, feedback_title text,
  question_id text, question_label text, question_type text, option_value text,
  response_count bigint, avg_numeric_value numeric
)
language sql stable security invoker set search_path = ''
as $$ select * from private.get_instructor_aggregates_filtered(p_course_id,p_from_date,p_to_date,p_semester_id) $$;
revoke all on function public.get_instructor_aggregates_filtered(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_instructor_aggregates_filtered(uuid,date,date,uuid) to authenticated;
