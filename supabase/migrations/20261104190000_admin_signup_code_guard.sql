-- Restrict administrator creation to users who provide the server-verified signup code.
create schema if not exists private;

create table if not exists private.admin_signup_settings (
  singleton boolean primary key default true check (singleton),
  code_sha256 bytea not null,
  updated_at timestamptz not null default now()
);

insert into private.admin_signup_settings (singleton, code_sha256)
values (true, decode('69836163ec330bea59a4f306beb5f28de3179b2d01ecea81c86166ca3c850b4c', 'hex'))
on conflict (singleton) do update
set code_sha256 = excluded.code_sha256, updated_at = now();

revoke all on private.admin_signup_settings from public, anon, authenticated;
grant select on private.admin_signup_settings to postgres, service_role;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_requested_role text;
  v_admin_code text;
  v_role public.app_role := 'STUDENT'::public.app_role;
  v_expected_hash bytea;
begin
  v_requested_role := upper(coalesce(new.raw_user_meta_data ->> 'requested_role', 'STUDENT'));

  if v_requested_role = 'ADMIN' then
    v_admin_code := coalesce(new.raw_user_meta_data ->> 'admin_signup_code', '');
    select s.code_sha256 into v_expected_hash
    from private.admin_signup_settings s where s.singleton = true;

    if v_expected_hash is null or extensions.digest(v_admin_code, 'sha256') is distinct from v_expected_hash then
      raise exception 'Invalid administrator signup code' using errcode = '42501';
    end if;
    v_role := 'ADMIN'::public.app_role;
  elsif v_requested_role <> 'STUDENT' then
    raise exception 'Unsupported signup role' using errcode = '22023';
  end if;

  insert into public.users (id, email, full_name, role)
  values (new.id, lower(new.email), left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), v_role)
  on conflict (id) do nothing;

  update auth.users
  set raw_app_meta_data = case when v_role = 'ADMIN'
        then coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'ADMIN')
        else coalesce(raw_app_meta_data, '{}'::jsonb) end,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'admin_signup_code' - 'requested_role'
  where id = new.id;

  return new;
end;
$function$;

create or replace function public.claim_admin_signup(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expected_hash bytea;
  v_identity_verified boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select (u.confirmed_at is not null or u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
    into v_identity_verified
  from auth.users u
  where u.id = v_user_id;

  if coalesce(v_identity_verified, false) is not true then
    raise exception 'Verify your email or mobile number before activating Admin' using errcode = '42501';
  end if;

  if p_code is null or length(p_code) < 1 or length(p_code) > 256 then
    raise exception 'Invalid administrator signup code' using errcode = '42501';
  end if;

  select s.code_sha256 into v_expected_hash
  from private.admin_signup_settings s where s.singleton = true;

  if v_expected_hash is null or extensions.digest(p_code, 'sha256') is distinct from v_expected_hash then
    raise exception 'Invalid administrator signup code' using errcode = '42501';
  end if;

  update public.users
  set role = 'ADMIN'::public.app_role, updated_at = now()
  where id = v_user_id and role = 'STUDENT'::public.app_role;

  if not found then
    raise exception 'This account cannot be promoted to administrator' using errcode = '42501';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'ADMIN'),
      updated_at = now()
  where id = v_user_id;
end;
$$;

revoke all on function public.claim_admin_signup(text) from public, anon;
grant execute on function public.claim_admin_signup(text) to authenticated;
