-- Filtered anonymous comment/export RPC. Direct API reads of the projection
-- table are revoked so callers cannot combine arbitrary date ranges with RLS
-- and isolate cohorts smaller than the report threshold.

revoke all on table public.feedback_submissions from public, anon, authenticated, service_role;
drop policy if exists feedback_submissions_instructor_read on public.feedback_submissions;

create or replace function private.get_filtered_anonymous_feedback(
  p_course_id uuid default null,
  p_semester_id uuid default null,
  p_from_date date default null,
  p_to_date date default null,
  p_search text default null
)
returns table(id uuid,feedback_id uuid,course_id uuid,created_at timestamptz,comment text,ratings_json jsonb,response_count bigint)
language plpgsql stable security definer set search_path = '' set row_security = off
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then raise exception 'Instructor access required' using errcode='42501'; end if;
  if p_from_date is not null and p_to_date is not null and p_from_date>p_to_date then raise exception 'Start date must be on or before end date' using errcode='22023'; end if;
  if p_search is not null and char_length(p_search)>100 then raise exception 'Search query is too long' using errcode='22023'; end if;
  return query
  with scoped as (
    select s.id,s.feedback_id,s.course_id,s.created_at,s.comment,s.ratings_json
    from public.feedback_submissions s
    join public.courses c on c.id=s.course_id and c.organization_id=s.organization_id
    where s.organization_id=private.current_organization_id()
      and (p_course_id is null or s.course_id=p_course_id)
      and (p_semester_id is null or c.semester_id=p_semester_id)
      and (p_from_date is null or s.created_at >= (p_from_date::timestamp at time zone 'UTC'))
      and (p_to_date is null or s.created_at < ((p_to_date+1)::timestamp at time zone 'UTC'))
      and (private.is_admin() or private.is_course_owner(s.course_id))
  ), counted as (
    select scoped.*,count(*) over(partition by scoped.feedback_id)::bigint group_count from scoped
  )
  select counted.id,counted.feedback_id,counted.course_id,counted.created_at,counted.comment,counted.ratings_json,counted.group_count
  from counted
  where counted.group_count>=5 and (p_search is null or p_search='' or position(lower(p_search) in lower(counted.comment))>0)
  order by counted.created_at desc limit 5000;
end;
$function$;
revoke all on function private.get_filtered_anonymous_feedback(uuid,uuid,date,date,text) from public, anon;
grant execute on function private.get_filtered_anonymous_feedback(uuid,uuid,date,date,text) to authenticated;

create or replace function public.get_filtered_anonymous_feedback(
  p_course_id uuid default null,
  p_semester_id uuid default null,
  p_from_date date default null,
  p_to_date date default null,
  p_search text default null
)
returns table(id uuid,feedback_id uuid,course_id uuid,created_at timestamptz,comment text,ratings_json jsonb,response_count bigint)
language sql stable security invoker set search_path = ''
as $function$
  select * from private.get_filtered_anonymous_feedback(p_course_id,p_semester_id,p_from_date,p_to_date,p_search);
$function$;
revoke all on function public.get_filtered_anonymous_feedback(uuid,uuid,date,date,text) from public, anon;
grant execute on function public.get_filtered_anonymous_feedback(uuid,uuid,date,date,text) to authenticated;

create or replace function private.get_course_instructor_names(p_course_ids uuid[])
returns table(course_id uuid,instructor_name text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then raise exception 'Instructor access required' using errcode='42501'; end if;
  if p_course_ids is null or cardinality(p_course_ids)<1 or cardinality(p_course_ids)>10 then raise exception 'Select between 1 and 10 courses' using errcode='22023'; end if;
  return query
  select c.id,coalesce(string_agg(distinct instructor.full_name,', ' order by instructor.full_name),'Unassigned')::text
  from public.courses c
  left join lateral (
    select u.full_name from public.users u where u.id=c.instructor_id
    union
    select assigned.full_name from public.instructor_course_assignments a
      join public.users assigned on assigned.id=a.instructor_id
      where a.course_id=c.id and a.organization_id=c.organization_id
  ) instructor on true
  where c.id=any(p_course_ids) and c.organization_id=private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(c.id))
  group by c.id;
end;
$function$;
revoke all on function private.get_course_instructor_names(uuid[]) from public, anon;
grant execute on function private.get_course_instructor_names(uuid[]) to authenticated;

create or replace function public.get_course_instructor_names(p_course_ids uuid[])
returns table(course_id uuid,instructor_name text)
language sql stable security invoker set search_path = ''
as $function$
  select * from private.get_course_instructor_names(p_course_ids);
$function$;
revoke all on function public.get_course_instructor_names(uuid[]) from public, anon;
grant execute on function public.get_course_instructor_names(uuid[]) to authenticated;
