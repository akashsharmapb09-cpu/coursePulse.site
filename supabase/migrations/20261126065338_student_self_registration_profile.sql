-- Student self-registration stores each student's chosen academic programme.
alter table public.users
  add column if not exists program text;

alter table public.users
  drop constraint if exists users_program_length_check;

alter table public.users
  add constraint users_program_length_check
  check (program is null or char_length(btrim(program)) between 2 and 80);

-- Every public self-signup creates a Student profile. Client-supplied roles,
-- organization IDs and invitation metadata are never trusted for role assignment.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_full_name text := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120);
  v_program text := left(btrim(coalesce(new.raw_user_meta_data->>'program', '')), 80);
begin
  if char_length(v_full_name) < 2 then
    raise exception 'A student name is required' using errcode = '23514';
  end if;

  if char_length(v_program) < 2 then
    raise exception 'A student programme is required' using errcode = '23514';
  end if;

  insert into public.users (id, email, full_name, role, organization_id, department_id, program)
  values (new.id, lower(new.email), v_full_name, 'STUDENT'::public.app_role, null, null, v_program)
  on conflict (id) do nothing;

  -- Strip any client-supplied privilege or tenant hints from auth metadata.
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
