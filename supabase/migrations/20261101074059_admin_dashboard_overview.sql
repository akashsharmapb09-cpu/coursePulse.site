-- Admin-only institutional metrics. No student identifiers or raw comments are returned.
create or replace function private.get_admin_dashboard_overview()
returns table(
  total_students bigint,
  total_instructors bigint,
  total_courses bigint,
  total_departments bigint,
  total_feedback_forms bigint,
  total_responses bigint,
  participation_rate numeric,
  average_rating numeric,
  low_participation_forms jsonb
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
  if private.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then
    raise exception 'Administrator MFA is required' using errcode = '42501';
  end if;

  return query
  with all_responses as (
    select r.id, r.feedback_id, r.answers
    from public.responses r
    union all
    select a.id, a.feedback_id, a.answers
    from public.anonymous_submissions a
  ),
  response_counts as (
    select r.feedback_id, count(*)::bigint as response_count
    from all_responses r
    group by r.feedback_id
  ),
  form_cohorts as (
    select
      f.id as feedback_id,
      f.title as feedback_title,
      c.title as course_title,
      f.is_open,
      f.due_at,
      count(distinct e.student_id)::bigint as enrolled_count,
      coalesce(rc.response_count,0)::bigint as response_count
    from public.feedback f
    join public.courses c on c.id=f.course_id
    left join public.course_enrollments e on e.course_id=c.id
    left join response_counts rc on rc.feedback_id=f.id
    group by f.id,f.title,c.title,f.is_open,f.due_at,rc.response_count
  ),
  rating_answers as (
    select
      f.id as feedback_id,
      q.value->>'id' as question_id,
      (r.answers->>(q.value->>'id'))::numeric as score
    from public.feedback f
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    join all_responses r on r.feedback_id=f.id
    where q.value->>'type'='rating'
      and jsonb_typeof(r.answers->(q.value->>'id'))='number'
      and (r.answers->>(q.value->>'id')) ~ '^[1-5]$'
  ),
  reportable_rating_questions as (
    select feedback_id,question_id
    from rating_answers
    group by feedback_id,question_id
    having count(*)>=5
  )
  select
    (select count(*) from public.users where role='STUDENT'::public.app_role and is_active=true)::bigint,
    (select count(*) from public.users where role='INSTRUCTOR'::public.app_role and is_active=true)::bigint,
    (select count(*) from public.courses)::bigint,
    (select count(*) from public.departments)::bigint,
    (select count(*) from public.feedback)::bigint,
    coalesce((select sum(response_count) from response_counts),0)::bigint,
    (select round(sum(fc.response_count)::numeric*100/nullif(sum(fc.enrolled_count),0),1) from form_cohorts fc),
    (select round(avg(ra.score),2) from rating_answers ra join reportable_rating_questions rq using(feedback_id,question_id)),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'feedback_id',alerts.feedback_id,
        'feedback_title',alerts.feedback_title,
        'course_title',alerts.course_title,
        'message','Fewer than five submissions'
      ) order by alerts.feedback_title)
      from (
        select fc.feedback_id,fc.feedback_title,fc.course_title
        from form_cohorts fc
        where fc.is_open=true
          and (fc.due_at is null or fc.due_at>now())
          and fc.enrolled_count>=5
          and fc.response_count<5
        order by fc.feedback_title
        limit 10
      ) alerts
    ),'[]'::jsonb);
end;
$$;
revoke all on function private.get_admin_dashboard_overview() from public,anon,authenticated;
grant execute on function private.get_admin_dashboard_overview() to authenticated;

create or replace function public.get_admin_dashboard_overview()
returns table(
  total_students bigint,
  total_instructors bigint,
  total_courses bigint,
  total_departments bigint,
  total_feedback_forms bigint,
  total_responses bigint,
  participation_rate numeric,
  average_rating numeric,
  low_participation_forms jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_admin_dashboard_overview()
$$;
revoke all on function public.get_admin_dashboard_overview() from public,anon;
grant execute on function public.get_admin_dashboard_overview() to authenticated;
