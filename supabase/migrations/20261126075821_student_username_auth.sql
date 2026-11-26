-- Email-free student accounts: public username maps to a private Supabase Auth identity.
alter table public.users
  add column if not exists username text;

-- Keep existing student accounts usable by deriving a unique username from their existing
-- metadata/email once. The email remains private legacy data for those accounts.
with source as (
  select
    u.id,
    coalesce(
      nullif(left(regexp_replace(coalesce(nullif(lower(a.raw_user_meta_data->>'username'), ''), split_part(lower(coalesce(u.email, '')), '@', 1)), '[^a-z0-9_]+', '_', 'g'), 15), ''),
      'student'
    ) as base
  from public.users u
  left join auth.users a on a.id = u.id
  where u.role = 'STUDENT'::public.app_role and u.username is null
),
ranked as (
  select id, base, row_number() over (partition by base order by id) as duplicate_number
  from source
)
update public.users u
set username = case
  when length(r.base) < 3 or r.duplicate_number > 1
    then left(r.base, 15) || '_' || left(replace(r.id::text, '-', ''), 8)
  else r.base
end
from ranked r
where u.id = r.id;

alter table public.users
  drop constraint if exists users_username_format_check;

alter table public.users
  add constraint users_username_format_check
  check (username is null or username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists users_username_unique
  on public.users (lower(username))
  where username is not null;

-- Rate-limit identifiers are SHA-256 hashes. Keep this table out of the exposed API
-- and make the atomic counter callable only by the server-side service role.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.student_auth_rate_limits (
  bucket_hash text primary key,
  window_started_at timestamptz not null,
  attempts integer not null default 0
);
alter table private.student_auth_rate_limits enable row level security;
revoke all on table private.student_auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table private.student_auth_rate_limits to service_role;

create or replace function public.consume_student_auth_attempt(
  p_bucket_hash text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempts integer;
begin
  if p_bucket_hash !~ '^[a-f0-9]{64}$'
     or p_max_attempts < 1
     or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into private.student_auth_rate_limits as current_bucket (bucket_hash, window_started_at, attempts)
  values (p_bucket_hash, now(), 1)
  on conflict (bucket_hash) do update
  set
    window_started_at = case
      when current_bucket.window_started_at + make_interval(secs => p_window_seconds) <= now()
        then now()
      else current_bucket.window_started_at
    end,
    attempts = case
      when current_bucket.window_started_at + make_interval(secs => p_window_seconds) <= now()
        then 1
      else current_bucket.attempts + 1
    end
  returning attempts into v_attempts;

  return v_attempts <= p_max_attempts;
end;
$function$;

revoke all on function public.consume_student_auth_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_student_auth_attempt(text, integer, integer) to service_role;

-- Every new public account is a Student. For username-only accounts, the internal
-- .invalid Auth address is never copied into the public student profile.
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
  if char_length(v_full_name) < 2 then
    raise exception 'A student name is required' using errcode = '23514';
  end if;
  if char_length(v_program) < 2 then
    raise exception 'A student programme is required' using errcode = '23514';
  end if;
  if v_is_internal_username and v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'A valid student username is required' using errcode = '23514';
  end if;

  insert into public.users (id, email, username, full_name, role, organization_id, department_id, program)
  values (
    new.id,
    case when v_is_internal_username then null else lower(new.email) end,
    nullif(v_username, ''),
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
