-- Privacy-preserving data deletion request workflow.
-- A request records the workflow state, not a copy of the user's account data.
create table private.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.users(id) on delete set null,
  status text not null default 'PENDING'
    check (status in ('PENDING','IN_REVIEW','APPROVED','REJECTED','COMPLETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text not null default '' check (char_length(resolution_note)<=500)
);
alter table private.data_deletion_requests enable row level security;
revoke all on table private.data_deletion_requests from public,anon,authenticated,service_role;
create policy data_deletion_requests_deny_direct_access
  on private.data_deletion_requests for all to anon,authenticated
  using(false) with check(false);
create unique index data_deletion_one_active_per_user
  on private.data_deletion_requests(requester_id)
  where requester_id is not null and status in ('PENDING','IN_REVIEW','APPROVED');
create index data_deletion_requests_created_at_idx
  on private.data_deletion_requests(created_at desc);

create or replace function private.create_my_data_deletion_request()
returns table(id uuid,status text,created_at timestamptz,reviewed_at timestamptz,resolution_note text)
language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.users u where u.id=v_user_id and u.is_active=true) then
    raise exception 'Active account required' using errcode='42501';
  end if;
  insert into private.data_deletion_requests(requester_id) values(v_user_id);
  return query select r.id,r.status,r.created_at,r.reviewed_at,r.resolution_note
  from private.data_deletion_requests r where r.requester_id=v_user_id
  order by r.created_at desc limit 1;
end;
$$;
revoke all on function private.create_my_data_deletion_request() from public,anon,authenticated;
grant execute on function private.create_my_data_deletion_request() to authenticated;

create or replace function public.create_my_data_deletion_request()
returns table(id uuid,status text,created_at timestamptz,reviewed_at timestamptz,resolution_note text)
language sql security invoker set search_path=''
as $$ select * from private.create_my_data_deletion_request() $$;
revoke all on function public.create_my_data_deletion_request() from public,anon;
grant execute on function public.create_my_data_deletion_request() to authenticated;

create or replace function private.get_my_data_deletion_requests()
returns table(id uuid,status text,created_at timestamptz,reviewed_at timestamptz,resolution_note text)
language sql stable security definer set search_path=''
as $$
  select r.id,r.status,r.created_at,r.reviewed_at,r.resolution_note
  from private.data_deletion_requests r
  where r.requester_id=(select auth.uid())
  order by r.created_at desc limit 20
$$;
revoke all on function private.get_my_data_deletion_requests() from public,anon,authenticated;
grant execute on function private.get_my_data_deletion_requests() to authenticated;

create or replace function public.get_my_data_deletion_requests()
returns table(id uuid,status text,created_at timestamptz,reviewed_at timestamptz,resolution_note text)
language sql security invoker set search_path=''
as $$ select * from private.get_my_data_deletion_requests() $$;
revoke all on function public.get_my_data_deletion_requests() from public,anon;
grant execute on function public.get_my_data_deletion_requests() to authenticated;

create or replace function private.admin_list_data_deletion_requests()
returns table(
  id uuid,requester_id uuid,requester_name text,requester_email text,requester_role public.app_role,
  status text,created_at timestamptz,reviewed_at timestamptz,reviewed_by uuid,resolution_note text
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not private.is_admin() or coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  return query
  select r.id,r.requester_id,u.full_name,u.email,u.role,r.status,r.created_at,r.reviewed_at,r.reviewed_by,r.resolution_note
  from private.data_deletion_requests r left join public.users u on u.id=r.requester_id
  order by r.created_at desc limit 100;
end;
$$;
revoke all on function private.admin_list_data_deletion_requests() from public,anon,authenticated;
grant execute on function private.admin_list_data_deletion_requests() to authenticated;

create or replace function public.admin_list_data_deletion_requests()
returns table(
  id uuid,requester_id uuid,requester_name text,requester_email text,requester_role public.app_role,
  status text,created_at timestamptz,reviewed_at timestamptz,reviewed_by uuid,resolution_note text
)
language sql stable security invoker set search_path=''
as $$ select * from private.admin_list_data_deletion_requests() $$;
revoke all on function public.admin_list_data_deletion_requests() from public,anon;
grant execute on function public.admin_list_data_deletion_requests() to authenticated;

create or replace function private.admin_review_data_deletion_request(
  p_request_id uuid,p_status text,p_resolution_note text
)
returns void language plpgsql security definer set search_path=''
as $$
declare v_current_status text;
begin
  if not private.is_admin() or coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  if p_status not in ('IN_REVIEW','APPROVED','REJECTED','COMPLETED')
    or p_resolution_note is null or char_length(p_resolution_note)>500 then
    raise exception 'Invalid deletion request review' using errcode='22023';
  end if;
  select r.status into v_current_status from private.data_deletion_requests r where r.id=p_request_id for update;
  if not found then raise exception 'Deletion request not found' using errcode='P0002'; end if;
  if not (
    (v_current_status='PENDING' and p_status in ('IN_REVIEW','APPROVED','REJECTED'))
    or (v_current_status='IN_REVIEW' and p_status in ('APPROVED','REJECTED'))
    or (v_current_status='APPROVED' and p_status in ('COMPLETED','REJECTED'))
  ) then raise exception 'Invalid deletion request status transition' using errcode='22023'; end if;
  if p_status='COMPLETED' and char_length(btrim(p_resolution_note))<12 then
    raise exception 'Describe how the deletion was carried out and verified before marking it complete' using errcode='22023';
  end if;
  update private.data_deletion_requests
  set status=p_status,updated_at=now(),reviewed_by=(select auth.uid()),reviewed_at=now(),resolution_note=p_resolution_note
  where id=p_request_id;
  perform private.admin_record_audit(
    'data_deletion.'||lower(p_status),'data_deletion_request',p_request_id,
    jsonb_build_object('status',p_status,'requester_id',(
      select requester_id from private.data_deletion_requests where id=p_request_id
    ))
  );
end;
$$;
revoke all on function private.admin_review_data_deletion_request(uuid,text,text) from public,anon,authenticated;
grant execute on function private.admin_review_data_deletion_request(uuid,text,text) to authenticated;

create or replace function public.admin_review_data_deletion_request(p_request_id uuid,p_status text,p_resolution_note text)
returns void language sql security invoker set search_path=''
as $$ select private.admin_review_data_deletion_request(p_request_id,p_status,p_resolution_note) $$;
revoke all on function public.admin_review_data_deletion_request(uuid,text,text) from public,anon;
grant execute on function public.admin_review_data_deletion_request(uuid,text,text) to authenticated;

alter table private.api_rate_limits drop constraint if exists api_rate_limits_action_check;
alter table private.api_rate_limits add constraint api_rate_limits_action_check
check(action in (
  'courses:create','feedback:create','responses:submit','admin:user-update',
  'account:password-change','account:profile-update','account:deletion-request'
));

create or replace function private.consume_api_rate_limit(p_action text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_window_start timestamptz;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_action not in (
    'courses:create','feedback:create','responses:submit','admin:user-update',
    'account:password-change','account:profile-update','account:deletion-request'
  ) or p_limit<1 or p_limit>100 or p_window_seconds<1 or p_window_seconds>86400 then
    raise exception 'Invalid rate limit configuration' using errcode='22023';
  end if;
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.api_rate_limits(user_id,action,window_start,request_count)
  values(v_user_id,p_action,v_window_start,1)
  on conflict(user_id,action,window_start)
  do update set request_count=private.api_rate_limits.request_count+1
  returning request_count into v_count;
  return v_count<=p_limit;
end;
$$;
revoke all on function private.consume_api_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function private.consume_api_rate_limit(text,integer,integer) to authenticated;
