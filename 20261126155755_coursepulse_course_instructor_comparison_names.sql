-- Return instructor display names for a bounded set of courses, after checking
-- that every course is inside the caller's authorized organization/scope.
create or replace function public.get_course_instructor_names(p_course_ids uuid[])
returns table(course_id uuid, instructor_name text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor access required' using errcode = '42501';
  end if;
  if p_course_ids is null or cardinality(p_course_ids) < 1 or cardinality(p_course_ids) > 10 then
    raise exception 'Select between 1 and 10 courses' using errcode = '22023';
  end if;
  return query
  select c.id,
    coalesce(string_agg(distinct coalesce(u.full_name, 'Instructor'), ', ' order by coalesce(u.full_name, 'Instructor')), 'Unassigned')::text
  from public.courses c
  left join public.users u on u.id = c.instructor_id
  left join public.instructor_course_assignments a on a.course_id = c.id and a.organization_id = c.organization_id
  left join public.users assigned on assigned.id = a.instructor_id
  cross join lateral (
    select coalesce(u.full_name, 'Instructor') as full_name
    union
    select assigned.full_name where assigned.id is not null
  ) u_names
  where c.id = any(p_course_ids) and c.organization_id = private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(c.id))
  group by c.id;
end;
$function$;
revoke all on function public.get_course_instructor_names(uuid[]) from public, anon;
grant execute on function public.get_course_instructor_names(uuid[]) to authenticated;
