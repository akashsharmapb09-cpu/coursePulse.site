-- Fix production provisioning privileges and typed platform HOD listing.
-- Keep service_role access limited to the two tables used by this Edge Function.
grant select, insert, update, delete
  on table public.organizations
  to service_role;

grant select, insert, update, delete
  on table public.organization_invitations
  to service_role;

create or replace function private.platform_list_organization_heads()
returns table(
  organization_id uuid,
  organization_name text,
  head_name text,
  head_email text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform Super Admin access with MFA is required' using errcode='42501';
  end if;

  return query
  select
    o.id,
    o.name::text,
    u.full_name::text,
    coalesce(a.email, u.email)::text,
    u.is_active
  from public.organizations o
  join public.users u
    on u.id = o.owner_user_id
   and u.organization_id = o.id
   and u.role = 'ADMIN'::public.app_role
  left join auth.users a on a.id = u.id
  order by o.created_at desc;
end;
$function$;

revoke all on function private.platform_list_organization_heads() from public, anon, authenticated;
grant execute on function private.platform_list_organization_heads() to authenticated;

create or replace function public.platform_list_organization_heads()
returns table(
  organization_id uuid,
  organization_name text,
  head_name text,
  head_email text,
  is_active boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.platform_list_organization_heads();
$function$;

revoke all on function public.platform_list_organization_heads() from public, anon;
grant execute on function public.platform_list_organization_heads() to authenticated;

create or replace function public.platform_record_college_invitation_audit(
  p_actor_id uuid,
  p_organization_id uuid,
  p_action text,
  p_new_status text,
  p_new_subscription_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_actor_id is null
     or not exists (select 1 from private.platform_admins pa where pa.user_id = p_actor_id) then
    raise exception 'The audit actor is not the registered Platform Super Admin' using errcode='42501';
  end if;

  if p_action not in ('organization.created_and_head_invited', 'organization.hod_invited') then
    raise exception 'Unsupported platform invitation audit action' using errcode='22023';
  end if;

  if p_new_status not in ('SETUP_REQUIRED', 'ACTIVE', 'SUSPENDED') then
    raise exception 'Invalid organization status for platform audit' using errcode='22023';
  end if;

  if p_new_subscription_status is not null
     and p_new_subscription_status not in ('UNCONFIGURED', 'PILOT', 'ACTIVE', 'PAST_DUE', 'CANCELLED') then
    raise exception 'Invalid subscription status for platform audit' using errcode='22023';
  end if;

  insert into private.platform_admin_audit(
    actor_id, organization_id, action, new_status, new_subscription_status
  ) values (
    p_actor_id, p_organization_id, p_action, p_new_status, p_new_subscription_status
  );
end;
$function$;

revoke all on function public.platform_record_college_invitation_audit(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.platform_record_college_invitation_audit(uuid, uuid, text, text, text)
  to service_role;
