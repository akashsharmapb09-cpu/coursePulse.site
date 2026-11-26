-- Comparison labels should show Instructor accounts, not a legacy HOD/Admin
-- who may still be the canonical owner of a course record.
create or replace function private.get_course_instructor_names(p_course_ids uuid[])
returns table(course_id uuid,instructor_name text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then
    raise exception 'Instructor access required' using errcode='42501';
  end if;
  if p_course_ids is null or cardinality(p_course_ids)<1 or cardinality(p_course_ids)>10 then
    raise exception 'Select between 1 and 10 courses' using errcode='22023';
  end if;
  return query
  select c.id,
    coalesce(string_agg(distinct instructor.full_name,', ' order by instructor.full_name),'Unassigned')::text
  from public.courses c
  left join lateral (
    select u.full_name
    from public.users u
    where u.id=c.instructor_id and u.role='INSTRUCTOR'::public.app_role
    union
    select assigned.full_name
    from public.instructor_course_assignments a
    join public.users assigned on assigned.id=a.instructor_id
    where a.course_id=c.id
      and a.organization_id=c.organization_id
      and assigned.role='INSTRUCTOR'::public.app_role
  ) instructor on true
  where c.id=any(p_course_ids)
    and c.organization_id=private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(c.id))
  group by c.id;
end;
$function$;
revoke all on function private.get_course_instructor_names(uuid[]) from public, anon, authenticated, service_role;
grant execute on function private.get_course_instructor_names(uuid[]) to authenticated;
