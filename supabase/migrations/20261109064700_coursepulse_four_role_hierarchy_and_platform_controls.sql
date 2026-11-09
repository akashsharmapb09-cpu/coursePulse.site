-- Four-role CoursePulse hierarchy: Super Admin > HOD > Teacher > Student.
-- ADMIN remains the database value for HOD; INSTRUCTOR is presented as Teacher.
-- Platform Super Admin membership remains separate from college-scoped roles.

create or replace function private.admin_update_user(
  p_user_id uuid,
  p_role public.app_role,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := private.current_organization_id();
  v_old_role public.app_role;
  v_old_active boolean;
begin
  if not private.is_admin() or (select auth.jwt()->>'aal') <> 'aal2' then
    raise exception 'HOD role with MFA is required' using errcode='42501';
  end if;

  if p_role not in ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role) then
    raise exception 'HOD accounts are managed only by Platform Super Admin' using errcode='42501';
  end if;

  select role, is_active
  into v_old_role, v_old_active
  from public.users
  where id = p_user_id
    and organization_id = v_org
  for update;

  if not found then
    raise exception 'User not found in this college' using errcode='P0002';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot remove or change your own HOD access' using errcode='42501';
  end if;

  if v_old_role not in ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role) then
    raise exception 'HOD can manage Student and Teacher accounts only' using errcode='42501';
  end if;

  if p_role <> v_old_role then
    raise exception 'Role changes are controlled by the platform; HOD can only activate or remove Student/Teacher access' using errcode='42501';
  end if;

  update public.users
  set is_active = p_is_active,
      suspended_at = case
        when p_is_active then null
        else coalesce(suspended_at, now())
      end,
      updated_at = now()
  where id = p_user_id
    and organization_id = v_org;

  perform private.admin_record_audit(
    'user.access.updated',
    'user',
    p_user_id,
    jsonb_build_object(
      'role', v_old_role,
      'was_active', v_old_active,
      'is_active', p_is_active,
      'managed_by_role', 'HOD'
    )
  );
end;
$function$;

revoke all on function private.admin_update_user(uuid, public.app_role, boolean) from public, anon;
grant execute on function private.admin_update_user(uuid, public.app_role, boolean) to authenticated;

create or replace function private.platform_get_summary()
returns table(
  total_colleges bigint,
  active_colleges bigint,
  setup_required_colleges bigint,
  suspended_colleges bigint,
  active_students bigint,
  active_teachers bigint,
  active_hods bigint
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select count(*) from public.organizations),
    (select count(*) from public.organizations where status = 'ACTIVE'),
    (select count(*) from public.organizations where status = 'SETUP_REQUIRED'),
    (select count(*) from public.organizations where status = 'SUSPENDED'),
    (
      select count(*)
      from public.users u
      join public.organizations o on o.id = u.organization_id
      where u.role = 'STUDENT'::public.app_role
        and u.is_active
        and o.status = 'ACTIVE'
    ),
    (
      select count(*)
      from public.users u
      join public.organizations o on o.id = u.organization_id
      where u.role = 'INSTRUCTOR'::public.app_role
        and u.is_active
        and o.status = 'ACTIVE'
    ),
    (
      select count(*)
      from public.users u
      join public.organizations o on o.id = u.organization_id
      where u.role = 'ADMIN'::public.app_role
        and u.is_active
        and o.owner_user_id = u.id
        and o.status = 'ACTIVE'
    );
$function$;

revoke all on function private.platform_get_summary() from public, anon, authenticated;
grant execute on function private.platform_get_summary() to authenticated;

create or replace function public.platform_get_summary()
returns table(
  total_colleges bigint,
  active_colleges bigint,
  setup_required_colleges bigint,
  suspended_colleges bigint,
  active_students bigint,
  active_teachers bigint,
  active_hods bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.platform_get_summary();
$function$;

revoke all on function public.platform_get_summary() from public, anon;
grant execute on function public.platform_get_summary() to authenticated;

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
    o.name,
    u.full_name,
    coalesce(a.email, u.email),
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

create or replace function private.platform_remove_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_status text;
  v_subscription text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform Super Admin access with MFA is required' using errcode='42501';
  end if;

  select status, subscription_status
  into v_old_status, v_subscription
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    raise exception 'College workspace not found' using errcode='P0002';
  end if;

  update public.organizations
  set status = 'SUSPENDED',
      updated_at = now()
  where id = p_organization_id;

  insert into private.platform_admin_audit(
    actor_id, organization_id, action, old_status, new_status,
    old_subscription_status, new_subscription_status
  ) values (
    (select auth.uid()), p_organization_id, 'organization.removed_from_active_platform',
    v_old_status, 'SUSPENDED', v_subscription, v_subscription
  );
end;
$function$;

revoke all on function private.platform_remove_organization(uuid) from public, anon, authenticated;
grant execute on function private.platform_remove_organization(uuid) to authenticated;

create or replace function public.platform_remove_organization(p_organization_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.platform_remove_organization(p_organization_id);
$function$;

revoke all on function public.platform_remove_organization(uuid) from public, anon;
grant execute on function public.platform_remove_organization(uuid) to authenticated;

create or replace function private.platform_remove_organization_head(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_status text;
  v_owner uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform Super Admin access with MFA is required' using errcode='42501';
  end if;

  select status, owner_user_id
  into v_old_status, v_owner
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    raise exception 'College workspace not found' using errcode='P0002';
  end if;

  if v_owner is null then
    raise exception 'This college has no assigned HOD account' using errcode='P0002';
  end if;

  if v_owner = (select auth.uid())
    or exists(select 1 from private.platform_admins p where p.user_id = v_owner) then
    raise exception 'A Platform Super Admin account cannot be removed as a HOD' using errcode='42501';
  end if;

  update public.users
  set is_active = false,
      suspended_at = coalesce(suspended_at, now()),
      updated_at = now()
  where id = v_owner
    and organization_id = p_organization_id
    and role = 'ADMIN'::public.app_role;

  if not found then
    raise exception 'The college HOD profile could not be found' using errcode='P0002';
  end if;

  update public.organizations
  set owner_user_id = null,
      status = case when v_old_status = 'SUSPENDED' then 'SUSPENDED' else 'SETUP_REQUIRED' end,
      updated_at = now()
  where id = p_organization_id;

  insert into private.platform_admin_audit(
    actor_id, organization_id, action, old_status, new_status
  ) values (
    (select auth.uid()), p_organization_id, 'organization.hod_access_removed',
    v_old_status,
    case when v_old_status = 'SUSPENDED' then 'SUSPENDED' else 'SETUP_REQUIRED' end
  );
end;
$function$;

revoke all on function private.platform_remove_organization_head(uuid) from public, anon, authenticated;
grant execute on function private.platform_remove_organization_head(uuid) to authenticated;

create or replace function public.platform_remove_organization_head(p_organization_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.platform_remove_organization_head(p_organization_id);
$function$;

revoke all on function public.platform_remove_organization_head(uuid) from public, anon;
grant execute on function public.platform_remove_organization_head(uuid) to authenticated;
