-- Do not activate a new college until its invited first Head verifies the email.
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
  where lower(i.email)=lower(NEW.email)
    and i.status in ('PENDING','INVITED')
    and i.expires_at>now()
  order by i.created_at desc
  limit 1
  for update;

  v_has_invitation := found;
  v_user_name := left(coalesce(NEW.raw_user_meta_data->>'full_name',v_invitation.full_name,''),120);

  insert into public.users(id,email,full_name,role,organization_id,department_id)
  values(
    NEW.id,lower(NEW.email),v_user_name,
    case when v_has_invitation then v_invitation.invited_role else 'STUDENT'::public.app_role end,
    case when v_has_invitation then v_invitation.organization_id else null end,
    case when v_has_invitation then v_invitation.department_id else null end
  )
  on conflict(id) do nothing;

  if v_has_invitation then
    update public.organization_invitations
    set status='ACCEPTED',auth_user_id=NEW.id,updated_at=now()
    where id=v_invitation.id;

    if v_invitation.invited_role='ADMIN'::public.app_role then
      update public.organizations
      set owner_user_id=coalesce(owner_user_id,NEW.id),
          status=case when NEW.email_confirmed_at is not null or NEW.phone_confirmed_at is not null
            then 'ACTIVE' else 'SETUP_REQUIRED' end,
          updated_at=now()
      where id=v_invitation.organization_id;
    elsif v_invitation.invited_role='STUDENT'::public.app_role then
      insert into public.student_directory(organization_id,student_id,student_number,department_id)
      values(v_invitation.organization_id,NEW.id,v_invitation.student_number,v_invitation.department_id)
      on conflict(organization_id,student_id) do update
      set student_number=excluded.student_number,department_id=excluded.department_id,updated_at=now();

      if nullif(btrim(v_invitation.mobile),'') is not null then
        insert into private.student_contact_profiles(organization_id,student_id,mobile)
        values(v_invitation.organization_id,NEW.id,v_invitation.mobile)
        on conflict(organization_id,student_id) do update
        set mobile=excluded.mobile,updated_at=now();
      end if;

      foreach v_course in array v_invitation.course_ids loop
        insert into public.course_enrollments(course_id,student_id,enrolled_by,organization_id,section)
        values(v_course,NEW.id,v_invitation.invited_by,v_invitation.organization_id,v_invitation.section)
        on conflict(course_id,student_id) do nothing;
      end loop;
    elsif v_invitation.invited_role='INSTRUCTOR'::public.app_role then
      foreach v_course in array v_invitation.course_ids loop
        insert into public.instructor_course_assignments(course_id,instructor_id,assigned_by,organization_id)
        values(v_course,NEW.id,v_invitation.invited_by,v_invitation.organization_id)
        on conflict(course_id,instructor_id) do nothing;
      end loop;
    end if;
  end if;

  update auth.users
  set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)
    - 'admin_signup_code' - 'requested_role' - 'organization_id' - 'role'
  where id=NEW.id;
  return NEW;
end;
$$;

create or replace function public.activate_college_workspace_after_auth_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.email_confirmed_at is null and new.email_confirmed_at is not null)
    or (old.phone_confirmed_at is null and new.phone_confirmed_at is not null) then
    update public.organizations o
    set status='ACTIVE',updated_at=now()
    where o.owner_user_id=new.id
      and o.status='SETUP_REQUIRED'
      and exists(
        select 1 from public.users u
        where u.id=new.id and u.organization_id=o.id
          and u.role='ADMIN'::public.app_role and u.is_active=true
      );
  end if;
  return new;
end;
$$;
revoke all on function public.activate_college_workspace_after_auth_verification() from public,anon,authenticated,service_role;

drop trigger if exists auth_activate_college_after_verification on auth.users;
create trigger auth_activate_college_after_verification
after update of email_confirmed_at,phone_confirmed_at on auth.users
for each row execute function public.activate_college_workspace_after_auth_verification();

create or replace function public.accept_existing_college_head_invitation(p_invitation_id uuid)
returns table(status text,auth_user_id uuid)
language plpgsql
security definer
set search_path = ''
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

  select * into v_auth from auth.users
  where lower(email)=lower(v_invitation.email) for update;
  if not found then raise exception 'No existing account was found' using errcode='P0002'; end if;
  if v_auth.email_confirmed_at is null and v_auth.phone_confirmed_at is null then
    raise exception 'Existing account must verify its email or phone first' using errcode='42501';
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
    values(v_auth.id,lower(v_auth.email),v_invitation.full_name,'ADMIN'::public.app_role,v_invitation.organization_id,true);
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
