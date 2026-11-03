-- Expose only instructor names for the authenticated student's own enrolled courses.
-- Do not grant students access to the general users table or instructor email addresses.
create or replace function private.get_student_course_instructors()
returns table(course_id uuid, instructor_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := (select auth.uid());
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if private.current_app_role() <> 'STUDENT'::public.app_role then
    raise exception 'Student role required' using errcode = '42501';
  end if;

  return query
  with accessible_courses as (
    select c.id as course_id, c.instructor_id
    from public.courses c
    join public.course_enrollments e on e.course_id=c.id and e.student_id=v_student_id
    where c.status='PUBLISHED'::public.course_status

    union

    select c.id as course_id, a.instructor_id
    from public.courses c
    join public.course_enrollments e on e.course_id=c.id and e.student_id=v_student_id
    join public.instructor_course_assignments a on a.course_id=c.id
    where c.status='PUBLISHED'::public.course_status
  )
  select distinct accessible.course_id, nullif(btrim(u.full_name),'')
  from accessible_courses accessible
  join public.users u on u.id=accessible.instructor_id
  where u.is_active=true and nullif(btrim(u.full_name),'') is not null;
end;
$$;

revoke all on function private.get_student_course_instructors() from public, anon, authenticated;
grant execute on function private.get_student_course_instructors() to authenticated;

create or replace function public.get_student_course_instructors()
returns table(course_id uuid, instructor_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_student_course_instructors()
$$;

revoke all on function public.get_student_course_instructors() from public, anon;
grant execute on function public.get_student_course_instructors() to authenticated;
