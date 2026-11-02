create or replace function private.get_instructor_response_trends_filtered(
  p_course_id uuid default null,
  p_from_date date default null,
  p_to_date date default null,
  p_semester_id uuid default null,
  p_department_id uuid default null
)
returns table(course_id uuid,course_title text,week_start date,response_count bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode='42501';
  end if;
  return query
  with all_responses as (
    select r.id,r.feedback_id,r.submitted_at from public.responses r
    union all
    select a.id,a.feedback_id,a.submitted_at from public.anonymous_submissions a
  )
  select c.id,c.title,date_trunc('week',r.submitted_at)::date,count(distinct r.id)::bigint
  from public.courses c
  join public.feedback f on f.course_id=c.id
  join all_responses r on r.feedback_id=f.id
  where (p_course_id is null or c.id=p_course_id)
    and (p_from_date is null or r.submitted_at::date>=p_from_date)
    and (p_to_date is null or r.submitted_at::date<=p_to_date)
    and (p_semester_id is null or c.semester_id=p_semester_id)
    and (p_department_id is null or c.department_id=p_department_id)
    and (private.is_admin() or (private.is_instructor() and private.is_course_owner(c.id)))
  group by c.id,c.title,date_trunc('week',r.submitted_at)::date
  having count(distinct r.id)>=5;
end;
$$;
revoke all on function private.get_instructor_response_trends_filtered(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_response_trends_filtered(uuid,date,date,uuid,uuid) to authenticated;
create or replace function public.get_instructor_response_trends_filtered(
  p_course_id uuid default null,p_from_date date default null,p_to_date date default null,
  p_semester_id uuid default null,p_department_id uuid default null
)
returns table(course_id uuid,course_title text,week_start date,response_count bigint)
language sql stable security invoker set search_path=''
as $$ select * from private.get_instructor_response_trends_filtered(p_course_id,p_from_date,p_to_date,p_semester_id,p_department_id) $$;
revoke all on function public.get_instructor_response_trends_filtered(uuid,date,date,uuid,uuid) from public,anon;
grant execute on function public.get_instructor_response_trends_filtered(uuid,date,date,uuid,uuid) to authenticated;
