-- Phone-first authentication and phone-addressed organization invitations.
-- Existing email identities and invitation rows are preserved for a gradual migration.
begin;

alter table public.organization_invitations
  alter column email drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.organization_invitations'::regclass
      and conname='organization_invitations_email_or_mobile_required'
  ) then
    alter table public.organization_invitations
      add constraint organization_invitations_email_or_mobile_required
      check (email is not null or mobile is not null);
  end if;
end
$$;

create unique index if not exists organization_invitations_pending_mobile
  on public.organization_invitations(organization_id,mobile)
  where mobile is not null and status in ('PENDING','INVITED');

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.organization_invitations%rowtype;
  v_has_invitation boolean := false;
  v_user_name text;
  v_course uuid;
begin
  select * into v_invitation
  from public.organization_invitations i
  where (
      (new.phone is not null and i.mobile=new.phone)
      or (new.email is not null and i.email is not null and lower(i.email)=lower(new.email))
    )
    and i.status in ('PENDING','INVITED')
    and i.expires_at>now()
  order by
    case when new.phone is not null and i.mobile=new.phone then 0 else 1 end,
    i.created_at desc
  limit 1
  for update;

  v_has_invitation := found;
  v_user_name := left(coalesce(new.raw_user_meta_data->>'full_name',v_invitation.full_name,''),120);

  insert into public.users(id,email,full_name,role,organization_id,department_id)
  values(
    new.id,
    case when new.email is null then null else lower(new.email) end,
    v_user_name,
    case when v_has_invitation then v_invitation.invited_role else 'STUDENT'::public.app_role end,
    case when v_has_invitation then v_invitation.organization_id else null end,
    case when v_has_invitation then v_invitation.department_id else null end
  )
  on conflict(id) do nothing;

  if v_has_invitation then
    update public.organization_invitations
    set status='ACCEPTED',auth_user_id=new.id,updated_at=now()
    where id=v_invitation.id;

    if v_invitation.invited_role='ADMIN'::public.app_role then
      update public.organizations
      set owner_user_id=coalesce(owner_user_id,new.id),
          status=case when new.email_confirmed_at is not null or new.phone_confirmed_at is not null
            then 'ACTIVE' else 'SETUP_REQUIRED' end,
          updated_at=now()
      where id=v_invitation.organization_id;
    elsif v_invitation.invited_role='STUDENT'::public.app_role then
      insert into public.student_directory(organization_id,student_id,student_number,department_id)
      values(v_invitation.organization_id,new.id,v_invitation.student_number,v_invitation.department_id)
      on conflict(organization_id,student_id) do update
      set student_number=excluded.student_number,department_id=excluded.department_id,updated_at=now();

      foreach v_course in array v_invitation.course_ids loop
        insert into public.course_enrollments(course_id,student_id,enrolled_by,organization_id,section)
        values(v_course,new.id,v_invitation.invited_by,v_invitation.organization_id,v_invitation.section)
        on conflict(course_id,student_id) do nothing;
      end loop;
    elsif v_invitation.invited_role='INSTRUCTOR'::public.app_role then
      foreach v_course in array v_invitation.course_ids loop
        insert into public.instructor_course_assignments(course_id,instructor_id,assigned_by,organization_id)
        values(v_course,new.id,v_invitation.invited_by,v_invitation.organization_id)
        on conflict(course_id,instructor_id) do nothing;
      end loop;
    end if;
  end if;

  update auth.users
  set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)
    - 'admin_signup_code' - 'requested_role' - 'organization_id' - 'role'
  where id=new.id;

  return new;
end;
$$;

-- Store a student's mobile number only after Supabase confirms possession of it.
create or replace function public.capture_verified_student_mobile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  v_org uuid;
  v_role public.app_role;
  v_invitation public.organization_invitations%rowtype;
  v_course uuid;
  v_org_status text;
  v_owner uuid;
begin
  if new.phone is null or new.phone_confirmed_at is null then
    return new;
  end if;

  select u.organization_id,u.role into v_org,v_role
  from public.users u
  where u.id=new.id and u.is_active=true
  for update;

  if not found then
    return new;
  end if;

  -- A trusted, unexpired invitation can link an existing verified phone account.
  -- This makes the account-linking path work without relying on email delivery.
  select * into v_invitation
  from public.organization_invitations i
  where i.mobile=new.phone
    and i.status in ('PENDING','INVITED')
    and i.expires_at>now()
  order by i.created_at desc
  limit 1
  for update;

  if found then
    if v_org is not null and v_org<>v_invitation.organization_id then
      return new;
    end if;

    if v_invitation.invited_role='ADMIN'::public.app_role then
      select o.status,o.owner_user_id into v_org_status,v_owner
      from public.organizations o
      where o.id=v_invitation.organization_id
      for update;
      if v_role<>'STUDENT'::public.app_role or v_org_status<>'SETUP_REQUIRED' or v_owner is not null then
        return new;
      end if;

      update public.users
      set role='ADMIN'::public.app_role,
          organization_id=v_invitation.organization_id,
          department_id=null,
          is_active=true,
          suspended_at=null
      where id=new.id;

      update public.organizations
      set owner_user_id=new.id,status='ACTIVE',updated_at=now()
      where id=v_invitation.organization_id and status='SETUP_REQUIRED' and owner_user_id is null;

      if not found then
        raise exception 'College workspace could not be claimed from the verified invitation' using errcode='23514';
      end if;

      insert into private.platform_admin_audit(actor_id,organization_id,action,new_status)
      values(v_invitation.invited_by,v_invitation.organization_id,'organization.head_linked_existing_phone','ACTIVE');
    else
      if v_role<>v_invitation.invited_role then
        return new;
      end if;

      update public.users
      set organization_id=v_invitation.organization_id,
          department_id=v_invitation.department_id,
          full_name=case when char_length(btrim(full_name))<2 then v_invitation.full_name else full_name end,
          is_active=true,
          suspended_at=null
      where id=new.id;

      if v_invitation.invited_role='STUDENT'::public.app_role then
        insert into public.student_directory(organization_id,student_id,student_number,department_id)
        values(v_invitation.organization_id,new.id,v_invitation.student_number,v_invitation.department_id)
        on conflict(organization_id,student_id) do update
        set student_number=excluded.student_number,department_id=excluded.department_id,updated_at=now();

        foreach v_course in array v_invitation.course_ids loop
          insert into public.course_enrollments(course_id,student_id,enrolled_by,organization_id,section)
          values(v_course,new.id,v_invitation.invited_by,v_invitation.organization_id,v_invitation.section)
          on conflict(course_id,student_id) do nothing;
        end loop;
      elsif v_invitation.invited_role='INSTRUCTOR'::public.app_role then
        foreach v_course in array v_invitation.course_ids loop
          insert into public.instructor_course_assignments(course_id,instructor_id,assigned_by,organization_id)
          values(v_course,new.id,v_invitation.invited_by,v_invitation.organization_id)
          on conflict(course_id,instructor_id) do nothing;
        end loop;
      end if;
    end if;

    update public.organization_invitations
    set status='ACCEPTED',auth_user_id=new.id,updated_at=now()
    where id=v_invitation.id;

    insert into public.audit_logs(actor_id,action,target_type,target_id,details,organization_id)
    values(v_invitation.invited_by,'roster.account.linked_by_verified_phone','user',new.id,
      jsonb_build_object('role',v_invitation.invited_role,'invitation_id',v_invitation.id),
      v_invitation.organization_id);
  end if;

  select u.organization_id,u.role into v_org,v_role
  from public.users u
  where u.id=new.id and u.is_active=true;

  if v_org is not null and v_role='STUDENT'::public.app_role then
    insert into private.student_contact_profiles(organization_id,student_id,mobile)
    values(v_org,new.id,new.phone)
    on conflict(organization_id,student_id)
    do update set mobile=excluded.mobile,updated_at=now();
  end if;

  return new;
end;
$;
revoke all on function public.capture_verified_student_mobile() from public,anon,authenticated,service_role;
drop trigger if exists auth_capture_verified_student_mobile on auth.users;
create trigger auth_capture_verified_student_mobile
after insert or update of phone,phone_confirmed_at on auth.users
for each row execute function public.capture_verified_student_mobile();

create or replace function public.resolve_roster_phone(p_phone text)
returns table(auth_user_id uuid,phone_confirmed boolean,profile_role public.app_role,organization_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'Internal service access required' using errcode='42501';
  end if;
  if p_phone is null or p_phone !~ '^[+][1-9][0-9]{7,14}$' then return; end if;
  return query
  select a.id,(a.phone_confirmed_at is not null),u.role,u.organization_id
  from auth.users a
  left join public.users u on u.id=a.id
  where a.phone=p_phone
  limit 1;
end;
$$;
revoke all on function public.resolve_roster_phone(text) from public,anon,authenticated;
grant execute on function public.resolve_roster_phone(text) to service_role;

create or replace function public.accept_existing_organization_invitation(p_invitation_id uuid)
returns table(status text,auth_user_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_invitation public.organization_invitations%rowtype;
  v_auth auth.users%rowtype;
  v_profile public.users%rowtype;
  v_course uuid;
  v_role public.app_role;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'Internal service access required' using errcode='42501';
  end if;
  select * into v_invitation from public.organization_invitations
  where id=p_invitation_id and status='PENDING' for update;
  if not found then raise exception 'Invitation is not pending' using errcode='P0002'; end if;

  if v_invitation.mobile is not null then
    select * into v_auth from auth.users where phone=v_invitation.mobile for update;
  end if;
  if not found and v_invitation.email is not null then
    select * into v_auth from auth.users where lower(email)=lower(v_invitation.email) for update;
  end if;
  if not found then raise exception 'No existing account was found' using errcode='P0002'; end if;
  if v_auth.phone_confirmed_at is null and v_auth.email_confirmed_at is null then
    raise exception 'Existing account must verify its phone or email before roster linking' using errcode='42501';
  end if;

  select * into v_profile from public.users where id=v_auth.id for update;
  v_role:=v_invitation.invited_role;
  if found then
    if v_profile.organization_id is not null and v_profile.organization_id<>v_invitation.organization_id then
      raise exception 'This account already belongs to another college' using errcode='42501';
    end if;
    if v_profile.role<>v_role then
      raise exception 'The existing account role does not match this invitation' using errcode='42501';
    end if;
    update public.users set organization_id=v_invitation.organization_id,
      department_id=v_invitation.department_id,
      full_name=case when btrim(full_name)='' then v_invitation.full_name else full_name end,
      is_active=true,suspended_at=null
    where id=v_auth.id;
  else
    insert into public.users(id,email,full_name,role,organization_id,department_id,is_active)
    values(v_auth.id,case when v_auth.email is null then null else lower(v_auth.email) end,
      v_invitation.full_name,v_role,v_invitation.organization_id,v_invitation.department_id,true);
  end if;

  if v_role='STUDENT'::public.app_role then
    insert into public.student_directory(organization_id,student_id,student_number,department_id)
    values(v_invitation.organization_id,v_auth.id,v_invitation.student_number,v_invitation.department_id)
    on conflict(organization_id,student_id) do update
    set student_number=excluded.student_number,department_id=excluded.department_id,updated_at=now();

    if v_auth.phone_confirmed_at is not null and v_auth.phone is not null then
      insert into private.student_contact_profiles(organization_id,student_id,mobile)
      values(v_invitation.organization_id,v_auth.id,v_auth.phone)
      on conflict(organization_id,student_id) do update set mobile=excluded.mobile,updated_at=now();
    end if;
    foreach v_course in array v_invitation.course_ids loop
      insert into public.course_enrollments(course_id,student_id,enrolled_by,organization_id,section)
      values(v_course,v_auth.id,v_invitation.invited_by,v_invitation.organization_id,v_invitation.section)
      on conflict(course_id,student_id) do update set section=excluded.section;
    end loop;
  elsif v_role='INSTRUCTOR'::public.app_role then
    foreach v_course in array v_invitation.course_ids loop
      insert into public.instructor_course_assignments(course_id,instructor_id,assigned_by,organization_id)
      values(v_course,v_auth.id,v_invitation.invited_by,v_invitation.organization_id)
      on conflict(course_id,instructor_id) do nothing;
    end loop;
  else
    raise exception 'Unsupported invitation role' using errcode='22023';
  end if;

  update public.organization_invitations set status='ACCEPTED',auth_user_id=v_auth.id,updated_at=now()
  where id=v_invitation.id;
  insert into public.audit_logs(actor_id,action,target_type,target_id,details,organization_id)
  values(v_invitation.invited_by,'roster.account.linked','user',v_auth.id,
    jsonb_build_object('role',v_role,'invitation_id',v_invitation.id),v_invitation.organization_id);
  return query select 'LINKED_EXISTING'::text,v_auth.id;
end;
$$;
revoke all on function public.accept_existing_organization_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_existing_organization_invitation(uuid) to service_role;

create or replace function public.accept_existing_college_head_invitation(p_invitation_id uuid)
returns table(status text,auth_user_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_invitation public.organization_invitations%rowtype;
  v_auth auth.users%rowtype;
  v_profile public.users%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'Internal service access required' using errcode='42501';
  end if;
  select * into v_invitation from public.organization_invitations
  where id=p_invitation_id and invited_role='ADMIN'::public.app_role and status='PENDING'
  for update;
  if not found then raise exception 'College Head invitation is not pending' using errcode='P0002'; end if;

  if v_invitation.mobile is not null then
    select * into v_auth from auth.users where phone=v_invitation.mobile for update;
  end if;
  if not found and v_invitation.email is not null then
    select * into v_auth from auth.users where lower(email)=lower(v_invitation.email) for update;
  end if;
  if not found then raise exception 'No existing account was found' using errcode='P0002'; end if;
  if v_auth.phone_confirmed_at is null and v_auth.email_confirmed_at is null then
    raise exception 'Existing account must verify its phone or email first' using errcode='42501';
  end if;

  select * into v_profile from public.users where id=v_auth.id for update;
  if found then
    if v_profile.organization_id is not null or v_profile.role<>'STUDENT'::public.app_role then
      raise exception 'Existing account cannot be reassigned to a different college or role' using errcode='42501';
    end if;
    update public.users set role='ADMIN'::public.app_role,organization_id=v_invitation.organization_id,
      full_name=case when char_length(btrim(full_name))<2 then v_invitation.full_name else full_name end,
      department_id=null,is_active=true,suspended_at=null
    where id=v_auth.id;
  else
    insert into public.users(id,email,full_name,role,organization_id,is_active)
    values(v_auth.id,case when v_auth.email is null then null else lower(v_auth.email) end,
      v_invitation.full_name,'ADMIN'::public.app_role,v_invitation.organization_id,true);
  end if;

  update public.organizations set owner_user_id=v_auth.id,status='ACTIVE',updated_at=now()
  where id=v_invitation.organization_id and status='SETUP_REQUIRED';
  if not found then raise exception 'College workspace is not awaiting its first Head' using errcode='23514'; end if;

  update public.organization_invitations
  set status='ACCEPTED',auth_user_id=v_auth.id,updated_at=now()
  where id=v_invitation.id;

  insert into private.platform_admin_audit(actor_id,organization_id,action,new_status)
  values(v_invitation.invited_by,v_invitation.organization_id,'organization.head_linked_existing_account','ACTIVE');

  return query select 'LINKED_EXISTING'::text,v_auth.id;
end;
$$;
revoke all on function public.accept_existing_college_head_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_existing_college_head_invitation(uuid) to service_role;

commit;
