-- Persist aggregate-only monthly academic report snapshots and schedule prior-month generation.
create table public.monthly_academic_reports (
  report_month date not null,
  scope_type text not null check (scope_type in ('COLLEGE','DEPARTMENT','COURSE')),
  scope_id uuid not null,
  scope_label text not null check (char_length(scope_label) between 1 and 160),
  response_count bigint not null check (response_count >= 5),
  average_rating numeric(4,2) not null check (average_rating between 1 and 5),
  previous_average numeric(4,2),
  rating_change numeric(4,2),
  recommendation text not null check (char_length(recommendation) <= 800),
  generated_at timestamptz not null default now(),
  primary key (report_month, scope_type, scope_id)
);

alter table public.monthly_academic_reports enable row level security;
revoke all on public.monthly_academic_reports from anon, authenticated;
grant select on public.monthly_academic_reports to authenticated;

create policy monthly_academic_reports_head_read
  on public.monthly_academic_reports for select to authenticated
  using ((select private.is_admin()));

comment on table public.monthly_academic_reports is
  'Monthly course, department, and college rating aggregates only; stores no identities, answers, or comments.';

create or replace function private.generate_monthly_academic_reports(p_report_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_report_month)::date;
  v_end date := (date_trunc('month', p_report_month) + interval '1 month')::date;
  v_rows integer := 0;
begin
  if p_report_month is null then
    raise exception 'A report month is required';
  end if;

  delete from public.monthly_academic_reports
   where report_month = v_month;

  with source_ratings as (
    select
      c.id as course_id,
      c.title as course_title,
      c.department_id,
      d.name as department_name,
      f.id as feedback_id,
      q.value ->> 'id' as question_id,
      (s.answers ->> (q.value ->> 'id'))::numeric as rating
    from public.anonymous_submissions s
    join public.feedback f on f.id = s.feedback_id
    join public.courses c on c.id = f.course_id
    left join public.departments d on d.id = c.department_id
    cross join lateral jsonb_array_elements(f.form_schema) as q(value)
    where s.received_on >= v_month
      and s.received_on < v_end
      and q.value ->> 'type' = 'rating'
      and q.value ->> 'id' is not null
      and coalesce(s.answers ->> (q.value ->> 'id'), '') ~ '^[1-5]$'
  ),
  eligible_question_groups as (
    select
      course_id,
      course_title,
      department_id,
      department_name,
      feedback_id,
      question_id,
      count(*)::bigint as responses,
      avg(rating)::numeric as group_average
    from source_ratings
    group by course_id, course_title, department_id, department_name, feedback_id, question_id
    having count(*) >= 5
  ),
  course_metrics as (
    select
      'COURSE'::text as scope_type,
      course_id as scope_id,
      max(course_title) as scope_label,
      sum(responses)::bigint as response_count,
      (sum(group_average * responses) / nullif(sum(responses),0))::numeric(4,2) as average_rating
    from eligible_question_groups
    group by course_id
  ),
  department_question_groups as (
    select department_id, department_name, feedback_id, question_id,
      count(*)::bigint as responses,
      avg(rating)::numeric as group_average
    from source_ratings
    where department_id is not null
    group by department_id, department_name, feedback_id, question_id
    having count(*) >= 5
  ),
  department_metrics as (
    select
      'DEPARTMENT'::text as scope_type,
      department_id as scope_id,
      max(department_name) as scope_label,
      sum(responses)::bigint as response_count,
      (sum(group_average * responses) / nullif(sum(responses),0))::numeric(4,2) as average_rating
    from department_question_groups
    group by department_id
  ),
  college_question_groups as (
    select feedback_id, question_id,
      count(*)::bigint as responses,
      avg(rating)::numeric as group_average
    from source_ratings
    group by feedback_id, question_id
    having count(*) >= 5
  ),
  college_metrics as (
    select
      'COLLEGE'::text as scope_type,
      '00000000-0000-0000-0000-000000000000'::uuid as scope_id,
      'College-wide'::text as scope_label,
      sum(responses)::bigint as response_count,
      (sum(group_average * responses) / nullif(sum(responses),0))::numeric(4,2) as average_rating
    from college_question_groups
    having count(*) > 0
  ),
  all_metrics as (
    select * from course_metrics
    union all select * from department_metrics
    union all select * from college_metrics
  )
  insert into public.monthly_academic_reports (
    report_month, scope_type, scope_id, scope_label,
    response_count, average_rating, previous_average, rating_change,
    recommendation, generated_at
  )
  select
    v_month,
    current.scope_type,
    current.scope_id,
    current.scope_label,
    current.response_count,
    current.average_rating,
    previous.average_rating,
    case when previous.average_rating is null then null
         else (current.average_rating - previous.average_rating)::numeric(4,2) end,
    case
      when current.average_rating < 3.0 then 'Plan a supportive review of course delivery and identify teaching resources or mentoring that may help.'
      when current.average_rating < 3.5 then 'Review course structure and assessment feedback with the department and agree practical improvements.'
      when current.average_rating >= 4.25 then 'Capture effective teaching practices and share them as optional examples across the department.'
      else 'Continue monitoring this course and compare the next reporting period before changing the teaching plan.'
    end,
    now()
  from all_metrics current
  left join public.monthly_academic_reports previous
    on previous.report_month = (v_month - interval '1 month')::date
   and previous.scope_type = current.scope_type
   and previous.scope_id = current.scope_id
  on conflict (report_month, scope_type, scope_id) do update set
    scope_label = excluded.scope_label,
    response_count = excluded.response_count,
    average_rating = excluded.average_rating,
    previous_average = excluded.previous_average,
    rating_change = excluded.rating_change,
    recommendation = excluded.recommendation,
    generated_at = excluded.generated_at;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function private.generate_monthly_academic_reports(date) from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'coursepulse-monthly-academic-reports';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'coursepulse-monthly-academic-reports',
    '15 0 1 * *',
    'select private.generate_monthly_academic_reports((date_trunc(''month'', now() - interval ''1 month''))::date);'
  );
end
$$;
