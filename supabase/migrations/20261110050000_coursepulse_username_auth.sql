-- Username-first sign-in while keeping Supabase Auth email identities private.
-- This migration is additive. It does not modify Auth provider settings or existing passwords.

begin;

alter table public.users
  add column if not exists username text;

-- Preserve existing accounts: use the email local-part as a familiar username where possible.
-- Add a short stable suffix only when the local-part is missing or duplicated.
with source_names as (
  select
    u.id,
    left(
      trim(both '._-' from regexp_replace(
        lower(split_part(coalesce(u.email, ''), '@', 1)),
        '[^a-z0-9._-]+', '-', 'g'
      )),
      22
    ) as base_name
  from public.users u
),
ranked as (
  select
    id,
    base_name,
    row_number() over (partition by base_name order by id) as name_position
  from source_names
)
update public.users u
set username = case
  when char_length(coalesce(r.base_name, '')) >= 3 and r.name_position = 1
    then r.base_name
  when char_length(coalesce(r.base_name, '')) >= 3
    then left(r.base_name, 21) || '-' || left(replace(r.id::text, '-', ''), 8)
  else 'user-' || left(replace(r.id::text, '-', ''), 8)
end
from ranked r
where r.id = u.id
  and u.username is null;

alter table public.users
  alter column username set not null;

alter table public.users
  add constraint users_username_format_check
  check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

create unique index if not exists users_username_unique
  on public.users (username);

-- All user-profile insert paths receive a unique username even if they come from an
-- invitation/import flow that predates username-aware signup.
create or replace function private.assign_coursepulse_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate text;
begin
  if new.username is not null and btrim(new.username) <> '' then
    new.username := lower(btrim(new.username));
    if new.username !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
      raise exception 'Invalid username format' using errcode = '22023';
    end if;
    return new;
  end if;

  v_candidate := left(
    trim(both '._-' from regexp_replace(
      lower(split_part(coalesce(new.email, ''), '@', 1)),
      '[^a-z0-9._-]+', '-', 'g'
    )),
    22
  );

  if char_length(coalesce(v_candidate, '')) < 3 then
    v_candidate := 'user-' || left(replace(new.id::text, '-', ''), 8);
  elsif exists (
    select 1 from public.users u
    where u.username = v_candidate
      and u.id <> new.id
  ) then
    v_candidate := left(v_candidate, 21) || '-' || left(replace(new.id::text, '-', ''), 8);
  end if;

  new.username := v_candidate;
  return new;
end;
$function$;

drop trigger if exists users_assign_coursepulse_username on public.users;
create trigger users_assign_coursepulse_username
before insert on public.users
for each row execute function private.assign_coursepulse_username();

revoke all on function private.assign_coursepulse_username() from public, anon, authenticated;

-- The existing Auth profile trigger creates public.users first. This second trigger
-- replaces its fallback username with the signup-chosen username, if present.
create or replace function private.sync_coursepulse_auth_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text;
begin
  v_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if v_username <> '' then
    if v_username !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
      raise exception 'Invalid username format' using errcode = '22023';
    end if;

    update public.users
    set username = v_username,
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists auth_users_sync_coursepulse_username on auth.users;
create trigger auth_users_sync_coursepulse_username
after insert on auth.users
for each row execute function private.sync_coursepulse_auth_username();

revoke all on function private.sync_coursepulse_auth_username() from public, anon, authenticated;

-- Self-service username changes remain subject to the existing own-profile RLS policy.
grant update (username) on public.users to authenticated;

-- Username login is an unauthenticated mutation, so it has a separate hashed-key limiter.
-- Only the server-side elevated client may invoke the public wrapper.
create table if not exists private.username_login_rate_limits (
  identifier_hash text primary key
    check (identifier_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);

revoke all on private.username_login_rate_limits from public, anon, authenticated, service_role;

create or replace function private.consume_username_login_rate_limit(
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_identifier_hash is null
    or p_identifier_hash !~ '^[a-f0-9]{64}$'
    or p_limit < 1 or p_limit > 100
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid username login limiter parameters' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into private.username_login_rate_limits(
    identifier_hash, window_start, request_count, updated_at
  )
  values (p_identifier_hash, v_window_start, 1, now())
  on conflict (identifier_hash) do update
  set window_start = case
        when private.username_login_rate_limits.window_start < excluded.window_start
          then excluded.window_start
        else private.username_login_rate_limits.window_start
      end,
      request_count = case
        when private.username_login_rate_limits.window_start < excluded.window_start
          then 1
        else private.username_login_rate_limits.request_count + 1
      end,
      updated_at = now()
  returning request_count into v_count;

  -- Opportunistic cleanup keeps old IP/username hashes from accumulating forever.
  if extract(minute from clock_timestamp())::integer % 5 = 0
    and extract(second from clock_timestamp()) < 2 then
    delete from private.username_login_rate_limits
    where updated_at < now() - interval '24 hours';
  end if;

  return v_count <= p_limit;
end;
$function$;

revoke all on function private.consume_username_login_rate_limit(text, integer, integer)
  from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.consume_username_login_rate_limit(text, integer, integer)
  to service_role;

create or replace function public.consume_username_login_rate_limit(
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.consume_username_login_rate_limit(
    p_identifier_hash, p_limit, p_window_seconds
  );
$function$;

revoke all on function public.consume_username_login_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_username_login_rate_limit(text, integer, integer)
  to service_role;

comment on column public.users.username is
  'Unique lowercase login identifier. Username-to-Auth-email resolution occurs only on the trusted server.';

commit;
