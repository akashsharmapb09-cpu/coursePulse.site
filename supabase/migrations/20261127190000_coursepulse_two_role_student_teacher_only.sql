-- CoursePulse has exactly two application roles: Student and Teacher.
-- Existing HOD/Admin accounts become Teachers; course ownership remains with
-- the same user IDs, so their existing courses are not reassigned or lost.

BEGIN;

UPDATE public.users
SET role = 'INSTRUCTOR'::public.app_role,
    updated_at = now()
WHERE role = 'ADMIN'::public.app_role;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_two_role_only_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_two_role_only_check
  CHECK (role IN ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role));

-- Retain this helper for compatibility with policies and older RPCs, but
-- permanently disable all legacy Admin/HOD-only paths.
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT false
$function$;

-- Students use the existing username flow. Teachers can self-register with a
-- college email; Supabase Auth email confirmation gates their first sign-in.
-- Invitation-based Student/Teacher provisioning remains supported for class
-- rosters, but no Admin/HOD invitation or self-claim path exists.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_full_name text := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120);
  v_program text := left(btrim(coalesce(new.raw_user_meta_data->>'program', '')), 80);
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_requested_role text := upper(btrim(coalesce(new.raw_user_meta_data->>'requested_role', '')));
  v_is_internal_username boolean := lower(coalesce(new.email, '')) like '%@students.coursepulse.invalid';
  v_invitation public.organization_invitations%rowtype;
  v_course_id uuid;
BEGIN
  IF v_is_internal_username THEN
    IF char_length(v_full_name) < 2 THEN
      RAISE EXCEPTION 'A student name is required' USING errcode = '23514';
    END IF;
    IF char_length(v_program) < 2 THEN
      RAISE EXCEPTION 'A student programme is required' USING errcode = '23514';
    END IF;
    IF v_username !~ '^[a-z0-9_]{3,24}$' THEN
      RAISE EXCEPTION 'A valid student username is required' USING errcode = '23514';
    END IF;

    INSERT INTO public.users (id, email, username, full_name, role, organization_id, department_id, program)
    VALUES (new.id, NULL, v_username, v_full_name, 'STUDENT'::public.app_role, NULL, NULL, v_program)
    ON CONFLICT (id) DO NOTHING;

  ELSIF v_requested_role = 'INSTRUCTOR' THEN
    IF new.email IS NULL OR position('@' in new.email) < 2 OR char_length(v_full_name) < 2 THEN
      RAISE EXCEPTION 'A valid Teacher name and college email are required' USING errcode = '23514';
    END IF;

    INSERT INTO public.users (id, email, username, full_name, role, organization_id, department_id, program, is_active)
    VALUES (new.id, lower(new.email), NULL, v_full_name, 'INSTRUCTOR'::public.app_role, NULL, NULL, NULL, true)
    ON CONFLICT (id) DO NOTHING;

  ELSE
    SELECT invitation.* INTO v_invitation
    FROM public.organization_invitations invitation
    JOIN public.organizations organization
      ON organization.id = invitation.organization_id
      AND organization.status = 'ACTIVE'::public.organization_status
    WHERE lower(invitation.email) = lower(coalesce(new.email, ''))
      AND invitation.status IN ('PENDING', 'INVITED')
      AND invitation.expires_at > now()
    ORDER BY invitation.created_at DESC
    LIMIT 1
    FOR UPDATE OF invitation;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A Student or Teacher signup is required.' USING errcode = '42501';
    END IF;
    IF v_invitation.invited_role NOT IN ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role) THEN
      RAISE EXCEPTION 'Only Student and Teacher accounts are supported.' USING errcode = '42501';
    END IF;
    IF char_length(btrim(v_invitation.full_name)) < 2 THEN
      RAISE EXCEPTION 'The invitation must include a valid full name.' USING errcode = '23514';
    END IF;
    IF cardinality(v_invitation.course_ids) < 1 THEN
      RAISE EXCEPTION 'The invitation must include at least one course.' USING errcode = '23514';
    END IF;

    INSERT INTO public.users (id, email, username, full_name, role, organization_id, department_id, program, is_active)
    VALUES (
      new.id, lower(new.email), NULL, left(btrim(v_invitation.full_name), 120),
      v_invitation.invited_role::public.app_role, v_invitation.organization_id,
      v_invitation.department_id, NULL, true
    )
    ON CONFLICT (id) DO NOTHING;

    IF v_invitation.invited_role = 'INSTRUCTOR'::public.app_role THEN
      FOREACH v_course_id IN ARRAY v_invitation.course_ids LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.courses course
          WHERE course.id = v_course_id
            AND course.organization_id = v_invitation.organization_id
        ) THEN
          RAISE EXCEPTION 'An invited course is outside the college.' USING errcode = '42501';
        END IF;
        INSERT INTO public.instructor_course_assignments(course_id, instructor_id, assigned_by, organization_id)
        VALUES (v_course_id, new.id, v_invitation.invited_by, v_invitation.organization_id)
        ON CONFLICT (course_id, instructor_id) DO NOTHING;
      END LOOP;

    ELSIF v_invitation.invited_role = 'STUDENT'::public.app_role THEN
      IF coalesce(btrim(v_invitation.student_number), '') = '' THEN
        RAISE EXCEPTION 'Student invitations must include a student number.' USING errcode = '23514';
      END IF;
      INSERT INTO public.student_directory(organization_id, student_id, student_number, department_id)
      VALUES (v_invitation.organization_id, new.id, btrim(v_invitation.student_number), v_invitation.department_id)
      ON CONFLICT (organization_id, student_id) DO UPDATE
        SET student_number = excluded.student_number,
            department_id = excluded.department_id,
            updated_at = now();

      FOREACH v_course_id IN ARRAY v_invitation.course_ids LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.courses course
          WHERE course.id = v_course_id
            AND course.organization_id = v_invitation.organization_id
        ) THEN
          RAISE EXCEPTION 'An invited course is outside the college.' USING errcode = '42501';
        END IF;
        INSERT INTO public.course_enrollments(course_id, student_id, enrolled_by, organization_id, section)
        VALUES (v_course_id, new.id, v_invitation.invited_by, v_invitation.organization_id, v_invitation.section)
        ON CONFLICT (course_id, student_id) DO NOTHING;
      END LOOP;
    END IF;

    UPDATE public.organization_invitations
    SET status = 'ACCEPTED', auth_user_id = new.id, updated_at = now()
    WHERE id = v_invitation.id;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'admin_signup_code'
    - 'requested_role'
    - 'organization_id'
    - 'role'
    - 'invitation_id'
  WHERE id = new.id;

  RETURN new;
END;
$function$;

COMMIT;
