-- Persist Head-configured thresholds and create private teacher meeting notices during monthly close.
create table public.monthly_report_settings (
  id smallint primary key check (id = 1),
  rating_threshold numeric(3,2) not null default 3.00 check (rating_threshold >= 1 and rating_threshold <= 5),
  minimum_responses integer not null default 10 check (minimum_responses between 5 and 100),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.monthly_report_settings(id, rating_threshold, minimum_responses)
values (1, 3.00, 10)
on conflict (id) do nothing;

alter table public.monthly_report_settings enable row level security;
revoke all on public.monthly_report_settings from anon, authenticated;
grant select, insert, update on public.monthly_report_settings to authenticated;

create policy monthly_report_settings_head_manage
  on public.monthly_report_settings for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

alter table public.teacher_notifications
  alter column created_by drop not null;

create or replace function private.notify_monthly_low_rated_teachers(p_report_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_report_month)::date;
  v_end date := (date_trunc('month', p_report_month) + interval '1 month')::date;
  v_threshold numeric;
  v_minimum integer;
  v_created integer := 0;
begin
  if p_report_month is null then
    raise exception 'A report month is required';
  end if;

  select rating_threshold, minimum_responses
    into v_threshold, v_minimum
  from public.monthly_report_settings
  where id = 1;

  v_threshold := coalesce(v_threshold, 3.00);
  v_minimum := coalesce(v_minimum, 10);

  with source_ratings as (
    select
      c.id as course_id,
      c.instructor_id as primary_instructor_id,
      f.id as feedback_id,
      q.value ->> 'id' as question_id,
      (s.answers ->> (q.value ->> 'id'))::numeric as rating
    from public.anonymous_submissions s
    join public.feedback f on f.id = s.feedback_id
    join public.courses c on c.id = f.course_id
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
      primary_instructor_id,
      feedback_id,
      question_id,
      count(*)::bigint as responses,
      avg(rating)::numeric as group_average
    from source_ratings
    group by course_id, primary_instructor_id, feedback_id, question_id
    having count(*) >= 5
  ),
  course_teachers as (
    select c.id as course_id, c.instructor_id as instructor_id
    from public.courses c
    union
    select a.course_id, a.instructor_id
    from public.instructor_course_assignments a
  ),
  teacher_metrics as (
    select
      assigned.instructor_id as recipient_id,
      sum(grouped.responses)::bigint as response_count,
      (sum(grouped.group_average * grouped.responses) / nullif(sum(grouped.responses),0))::numeric as average_rating
    from eligible_question_groups grouped
    join course_teachers assigned on assigned.course_id = grouped.course_id
    join public.users u on u.id = assigned.instructor_id
      and u.role = 'INSTRUCTOR'::public.app_role
      and u.is_active = true
    group by assigned.instructor_id
  )
  insert into public.teacher_notifications (
    recipient_id, created_by, category, period_start, title, body
  )
  select
    metric.recipient_id,
    null,
    'PERFORMANCE_REVIEW',
    v_month,
    'Private teaching feedback review',
    'Please meet the College Head for a confidential discussion about recent course feedback and possible teaching support. This is a supportive review request, not a disciplinary finding. The office will coordinate a suitable time with you.'
  from teacher_metrics metric
  where metric.response_count >= v_minimum
    and metric.average_rating < v_threshold
  on conflict (recipient_id, category, period_start) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function private.notify_monthly_low_rated_teachers(date) from public, anon, authenticated;

create or replace function private.run_monthly_academic_close(p_report_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reports integer;
  v_notifications integer;
begin
  v_reports := private.generate_monthly_academic_reports(p_report_month);
  v_notifications := private.notify_monthly_low_rated_teachers(p_report_month);
  return v_reports + v_notifications;
end;
$$;

revoke all on function private.run_monthly_academic_close(date) from public, anon, authenticated;

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
    'select private.run_monthly_academic_close((date_trunc(''month'', now() - interval ''1 month''))::date);'
  );
end
$$;

comment on table public.monthly_report_settings is
  'College Head MFA-protected thresholds used for monthly private teacher review notifications.';
