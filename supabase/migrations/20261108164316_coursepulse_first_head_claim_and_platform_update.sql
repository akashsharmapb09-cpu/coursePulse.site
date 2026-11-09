-- Finish first-head onboarding and Super Admin organization management.
create or replace function private.claim_setup_workspace(p_code text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid:=(select auth.uid());
  v_org uuid;
  v_verified boolean;
  v_hash bytea;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select (email_confirmed_at is not null or phone_confirmed_at is not null)
  into v_verified from auth.users where id=v_user;
  if not coalesce(v_verified,false) then raise exception 'Verify your email or mobile first' using errcode='42501'; end if;
  if not private.consume_api_rate_limit('admin-signup:claim',5,900) then
    raise exception 'Too many administrator signup attempts' using errcode='42900';
  end if;
  select id into v_org from public.organizations
  where status='SETUP_REQUIRED' and owner_user_id is null
  order by created_at limit 1 for update;
  if v_org is null then raise exception 'No unclaimed college workspace is available' using errcode='42501'; end if;
  select code_sha256 into v_hash from private.admin_signup_settings where singleton=true;
  if v_hash is null or extensions.digest(p_code,'sha256') is distinct from v_hash then
    raise exception 'Invalid administrator signup code' using errcode='42501';
  end if;
  update public.users set role='ADMIN'::public.app_role,organization_id=v_org,updated_at=now()
  where id=v_user and role='STUDENT'::public.app_role and organization_id is null;
  if not found then raise exception 'This account cannot claim the college workspace' using errcode='42501'; end if;
  update public.organizations set owner_user_id=v_user,status='ACTIVE',updated_at=now() where id=v_org;
  update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('role','ADMIN')
  where id=v_user;
  -- Initial Head claim occurs before MFA is enrolled; write this bootstrap audit event directly.
  insert into public.audit_logs(actor_id,action,target_type,target_id,details,organization_id)
  values(v_user,'organization.first_head_claimed','organization',v_org,jsonb_build_object('owner_user_id',v_user),v_org);
end;
$$;
revoke all on function private.claim_setup_workspace(text) from public,anon;
grant execute on function private.claim_setup_workspace(text) to authenticated;

drop table if exists private.organization_invitations;

create policy organizations_platform_update on public.organizations for update to authenticated
using(private.is_platform_admin()) with check(private.is_platform_admin());

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.uid()) is not null
    and (select auth.jwt()->>'aal')='aal2'
    and exists(select 1 from private.platform_admins p where p.user_id=(select auth.uid())),false)
$$;
