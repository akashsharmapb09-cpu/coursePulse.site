-- New Auth accounts must be created via the username-only student registration service.
-- Existing auth.users rows and their backfilled usernames are not modified.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_full_name text := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120);
  v_program text := left(btrim(coalesce(new.raw_user_meta_data->>'program', '')), 80);
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_is_internal_username boolean := lower(coalesce(new.email, '')) like '%@students.coursepulse.invalid';
begin
  if not v_is_internal_username then
    raise exception 'Use the CoursePulse student username registration service.' using errcode = '42501';
  end if;

  if char_length(v_full_name) < 2 then
    raise exception 'A student name is required' using errcode = '23514';
  end if;

  if char_length(v_program) < 2 then
    raise exception 'A student programme is required' using errcode = '23514';
  end if;

  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'A valid student username is required' using errcode = '23514';
  end if;

  insert into public.users (id, email, username, full_name, role, organization_id, department_id, program)
  values (
    new.id,
    null,
    v_username,
    v_full_name,
    'STUDENT'::public.app_role,
    null,
    null,
    v_program
  )
  on conflict (id) do nothing;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'admin_signup_code'
    - 'requested_role'
    - 'organization_id'
    - 'role'
    - 'invitation_id'
  where id = new.id;

  return new;
end;
$function$;
