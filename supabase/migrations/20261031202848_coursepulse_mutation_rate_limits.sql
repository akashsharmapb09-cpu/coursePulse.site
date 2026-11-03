-- Authenticated mutation rate limits. The scope is user + action + fixed window;
-- no IP address or answer content is stored.
create table private.api_rate_limits (
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('courses:create','feedback:create','responses:submit')),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, action, window_start)
);
alter table private.api_rate_limits enable row level security;
revoke all on table private.api_rate_limits from public, anon, authenticated, service_role;
create policy api_rate_limits_deny_direct_access
on private.api_rate_limits for all to anon, authenticated
using (false) with check (false);
create index api_rate_limits_window_idx on private.api_rate_limits(window_start);

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
  if p_action not in ('courses:create','feedback:create','responses:submit')
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

create or replace function public.consume_api_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.consume_api_rate_limit(p_action, p_limit, p_window_seconds) $$;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to authenticated;

-- Keep the private rate-limit ledger bounded by deleting windows older than two days.
create or replace function public.cleanup_expired_responses()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_legacy bigint;
  deleted_anonymous bigint;
  deleted_rate_limits bigint;
begin
  delete from public.responses r
  using public.feedback f
  where f.id = r.feedback_id
    and r.submitted_at < now() - make_interval(days => f.retention_days);
  get diagnostics deleted_legacy = row_count;

  delete from public.anonymous_submissions a
  using public.feedback f
  where f.id = a.feedback_id
    and a.received_on < (current_date - f.retention_days);
  get diagnostics deleted_anonymous = row_count;

  delete from private.api_rate_limits where window_start < now() - interval '2 days';
  get diagnostics deleted_rate_limits = row_count;

  return deleted_legacy + deleted_anonymous + deleted_rate_limits;
end;
$$;
revoke all on function public.cleanup_expired_responses() from public, anon, authenticated;
grant execute on function public.cleanup_expired_responses() to service_role;
