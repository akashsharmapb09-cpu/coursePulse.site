-- Complete the single-tenant-to-tenant migration for legacy user profiles.
-- This is safe only while the original workspace is the sole tenant. If a second
-- tenant already exists, refuse to guess the ownership of legacy unassigned users.
do $$
declare
  v_org_count integer;
  v_org uuid;
  v_unassigned bigint;
begin
  select count(*) into v_org_count from public.organizations;
  select id into v_org from public.organizations order by created_at limit 1;
  select count(*) into v_unassigned from public.users where organization_id is null;

  if v_org_count=1 then
    update public.users
       set organization_id=v_org,updated_at=now()
     where organization_id is null;
  elsif v_unassigned>0 then
    raise exception
      'Cannot auto-assign % legacy users across % college tenants; map them explicitly before continuing.',
      v_unassigned,v_org_count;
  end if;
end
$$;

create index if not exists users_organization_role_active_idx
  on public.users(organization_id,role,is_active);
