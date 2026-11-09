-- Head-safe organization settings, platform-owner controls, and column-level account security.
alter table public.student_directory
  drop constraint if exists student_directory_department_id_organization_id_fkey;
alter table public.student_directory
  add constraint student_directory_department_org_fkey
  foreign key(department_id,organization_id)
  references public.departments(id,organization_id)
  on delete restrict not valid;

-- A self-row RLS policy does not restrict which columns a user can edit.
-- The app only allows users to change their display name; privileged fields
-- are managed exclusively by SECURITY DEFINER routines.
revoke update on public.users from authenticated;
grant update(full_name) on public.users to authenticated;
revoke insert,delete on public.users from authenticated;

-- College Heads may rename their own workspace but cannot change platform
-- status, ownership, or subscription metadata.
drop policy if exists organizations_admin_update on public.organizations;
revoke update on public.organizations from authenticated;
grant select on public.organizations to authenticated;

create or replace function private.update_current_organization(p_name text,p_slug text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid:=private.current_organization_id();v_old_name text;v_old_slug text;
begin
  if not private.is_admin() or coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
    raise exception 'College Head administrator MFA is required' using errcode='42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 160
    or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'Provide a valid college name and URL slug' using errcode='22023';
  end if;
  select name,slug into v_old_name,v_old_slug from public.organizations where id=v_org for update;
  if not found then raise exception 'College workspace not found' using errcode='P0002'; end if;
  update public.organizations set name=btrim(p_name),slug=p_slug,updated_at=now() where id=v_org;
  perform private.admin_record_audit('organization.profile.updated','organization',v_org,
    jsonb_build_object('old_name',v_old_name,'new_name',btrim(p_name),'old_slug',v_old_slug,'new_slug',p_slug));
end;
$$;
revoke all on function private.update_current_organization(text,text) from public,anon,authenticated;
grant execute on function private.update_current_organization(text,text) to authenticated;

create or replace function public.update_current_organization(p_name text,p_slug text)
returns void language sql security invoker set search_path = ''
as $$ select private.update_current_organization(p_name,p_slug) $$;
revoke all on function public.update_current_organization(text,text) from public,anon;
grant execute on function public.update_current_organization(text,text) to authenticated;

create table if not exists private.platform_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  action text not null check(char_length(action) between 2 and 80),
  old_status text,
  new_status text,
  old_subscription_status text,
  new_subscription_status text,
  created_at timestamptz not null default now()
);
alter table private.platform_admin_audit enable row level security;
revoke all on private.platform_admin_audit from public,anon,authenticated;
create policy platform_admin_audit_platform_only on private.platform_admin_audit
  for select to authenticated using(private.is_platform_admin());

create or replace function private.platform_list_organizations()
returns table(
  id uuid,name text,slug text,status text,subscription_status text,
  created_at timestamptz,active_students bigint,active_instructors bigint,
  course_count bigint,department_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then raise exception 'Platform owner access required' using errcode='42501'; end if;
  return query
  select o.id,o.name,o.slug,o.status,o.subscription_status,o.created_at,
    (select count(*) from public.users u where u.organization_id=o.id and u.role='STUDENT'::public.app_role and u.is_active),
    (select count(*) from public.users u where u.organization_id=o.id and u.role='INSTRUCTOR'::public.app_role and u.is_active),
    (select count(*) from public.courses c where c.organization_id=o.id),
    (select count(*) from public.departments d where d.organization_id=o.id)
  from public.organizations o order by o.created_at desc;
end;
$$;
revoke all on function private.platform_list_organizations() from public,anon,authenticated;
grant execute on function private.platform_list_organizations() to authenticated;

create or replace function public.platform_list_organizations()
returns table(
  id uuid,name text,slug text,status text,subscription_status text,
  created_at timestamptz,active_students bigint,active_instructors bigint,
  course_count bigint,department_count bigint
)
language sql security invoker set search_path = ''
as $$ select * from private.platform_list_organizations() $$;
revoke all on function public.platform_list_organizations() from public,anon;
grant execute on function public.platform_list_organizations() to authenticated;

create or replace function private.platform_update_organization(
  p_organization_id uuid,p_status text,p_subscription_status text
)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old_status text;v_old_subscription text;
begin
  if not private.is_platform_admin() then raise exception 'Platform owner access required' using errcode='42501'; end if;
  if p_status not in ('SETUP_REQUIRED','ACTIVE','SUSPENDED')
    or p_subscription_status not in ('UNCONFIGURED','PILOT','ACTIVE','PAST_DUE','CANCELLED') then
    raise exception 'Invalid organization status' using errcode='22023';
  end if;
  select status,subscription_status into v_old_status,v_old_subscription
  from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'College workspace not found' using errcode='P0002'; end if;
  update public.organizations set status=p_status,subscription_status=p_subscription_status,updated_at=now()
  where id=p_organization_id;
  insert into private.platform_admin_audit(
    actor_id,organization_id,action,old_status,new_status,old_subscription_status,new_subscription_status
  ) values(
    (select auth.uid()),p_organization_id,'organization.platform.updated',
    v_old_status,p_status,v_old_subscription,p_subscription_status
  );
end;
$$;
revoke all on function private.platform_update_organization(uuid,text,text) from public,anon,authenticated;
grant execute on function private.platform_update_organization(uuid,text,text) to authenticated;

create or replace function public.platform_update_organization(
  p_organization_id uuid,p_status text,p_subscription_status text
)
returns void language sql security invoker set search_path = ''
as $$ select private.platform_update_organization(p_organization_id,p_status,p_subscription_status) $$;
revoke all on function public.platform_update_organization(uuid,text,text) from public,anon;
grant execute on function public.platform_update_organization(uuid,text,text) to authenticated;

create or replace function private.platform_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_platform_admin() $$;
revoke all on function private.platform_is_admin() from public,anon,authenticated;
grant execute on function private.platform_is_admin() to authenticated;
create or replace function public.platform_is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.platform_is_admin() $$;
revoke all on function public.platform_is_admin() from public,anon;
grant execute on function public.platform_is_admin() to authenticated;
