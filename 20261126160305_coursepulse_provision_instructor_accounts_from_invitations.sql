-- Permit staff accounts only through an active college invitation. Public
-- registration remains restricted to the existing username-only Student flow.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_full_name text := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120);
  v_program text := left(btrim(coalesce(new.raw_user_meta_data->>'program', '')), 80);
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_is_internal_username boolean := lower(coalesce(new.email, '')) like '%@students.coursepulse.invalid';
  v_invitation public.organization_invitations%rowtype;
  v_course_id uuid;
begin
  if v_is_internal_username then
    if char_length(v_full_name) < 2 then raise exception 'A student name is required' using errcode = '23514'; end if;
    if char_length(v_program) < 2 then raise exception 'A student programme is required' using errcode = '23514'; end if;
    if v_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'A valid student username is required' using errcode = '23514'; end if;
    insert into public.users (id, email, username, full_name, role, organization_id, department_id, program)
    values (new.id, null, v_username, v_full_name, 'STUDENT'::public.app_role, null, null, v_program)
    on conflict (id) do nothing;
  else
    select invitation.* into v_invitation
    from public.organization_invitations invitation
    join public.organizations organization on organization.id = invitation.organization_id
      and organization.status = 'ACTIVE'::public.organization_status
    where lower(invitation.email) = lower(coalesce(new.email, ''))
      and invitation.status in ('PENDING','INVITED') and invitation.expires_at > now()
    order by invitation.created_at desc limit 1 for update of invitation;

    if not found then raise exception 'An active college invitation is required for this account.' using errcode = '42501'; end if;
    if char_length(btrim(v_invitation.full_name)) < 2 then raise exception 'The invitation must include a valid full name.' using errcode = '23514'; end if;
    if cardinality(v_invitation.course_ids) < 1 then raise exception 'The invitation must include at least one course.' using errcode = '23514'; end if;

    insert into public.users (id, email, username, full_name, role, organization_id, department_id, program, is_active)
    values (new.id, lower(new.email), null, left(btrim(v_invitation.full_name),120),
      v_invitation.invited_role::public.app_role, v_invitation.organization_id, v_invitation.department_id, null, true)
    on conflict (id) do nothing;

    if v_invitation.invited_role = 'INSTRUCTOR'::public.app_role then
      foreach v_course_id in array v_invitation.course_ids loop
        if not exists (select 1 from public.courses course
          where course.id = v_course_id and course.organization_id = v_invitation.organization_id) then
          raise exception 'An invited course is outside the college.' using errcode = '42501';
        end if;
        insert into public.instructor_course_assignments(course_id, instructor_id, assigned_by, organization_id)
        values (v_course_id, new.id, v_invitation.invited_by, v_invitation.organization_id)
        on conflict (course_id, instructor_id) do nothing;
      end loop;
    elsif v_invitation.invited_role = 'STUDENT'::public.app_role then
      if coalesce(btrim(v_invitation.student_number), '') = '' then
        raise exception 'Student invitations must include a student number.' using errcode = '23514';
      end if;
      insert into public.student_directory(organization_id, student_id, student_number, department_id)
      values (v_invitation.organization_id, new.id, btrim(v_invitation.student_number), v_invitation.department_id)
      on conflict (organization_id, student_id) do update
        set student_number = excluded.student_number, department_id = excluded.department_id, updated_at = now();
      foreach v_course_id in array v_invitation.course_ids loop
        if not exists (select 1 from public.courses course
          where course.id = v_course_id and course.organization_id = v_invitation.organization_id) then
          raise exception 'An invited course is outside the college.' using errcode = '42501';
        end if;
        insert into public.course_enrollments(course_id, student_id, enrolled_by, organization_id, section)
        values (v_course_id, new.id, v_invitation.invited_by, v_invitation.organization_id, v_invitation.section)
        on conflict (course_id, student_id) do nothing;
      end loop;
    else
      raise exception 'Only Student and Instructor invitations are supported.' using errcode = '42501';
    end if;

    update public.organization_invitations set status = 'ACCEPTED', auth_user_id = new.id, updated_at = now()
    where id = v_invitation.id;
  end if;

  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'admin_signup_code' - 'requested_role' - 'organization_id' - 'role' - 'invitation_id'
  where id = new.id;
  return new;
end;
$function$;
