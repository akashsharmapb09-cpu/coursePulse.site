-- Allow account owners to update only their display name.
-- RLS remains the owner boundary; role, status, email and department stay read-only here.
grant update (full_name) on public.users to authenticated;

alter table private.api_rate_limits
  drop constraint if exists api_rate_limits_action_check;

alter table private.api_rate_limits
  add constraint api_rate_limits_action_check
  check (action in (
    'courses:create',
    'feedback:create',
    'responses:submit',
    'admin:user-update',
    'account:password-change',
    'account:profile-update'
  ));

create or replace function private.consume_api_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_window_start timestamptz;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_action not in (
    'courses:create',
    'feedback:create',
    'responses:submit',
    'admin:user-update',
    'account:password-change',
    'account:profile-update'
  )
    or p_limit < 1 or p_limit > 100
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit configuration' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.api_rate_limits(user_id, action, window_start, request_count)
  values (v_user_id, p_action, v_window_start, 1)
  on conflict (user_id, action, window_start)
  do update set request_count = private.api_rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function private.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function private.consume_api_rate_limit(text, integer, integer) to authenticated;
