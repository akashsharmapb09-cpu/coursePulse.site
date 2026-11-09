-- Safe provisioning of already-registered, verified accounts from a Head-approved invitation.
create or replace function public.resolve_roster_email(p_email text)
returns table(auth_user_id uuid,email_confirmed boolean,profile_role public.app_role,organization_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'Internal service access required' using errcode='42501';
  end if;
  if p_email is null or char_length(p_email)>254 then return; end if;
  return query
  select a.id,(a.email_confirmed_at is not null or a.phone_confirmed_at is not null),
    u.role,u.organization_id
  from auth.users a
  left join public.users u on u.id=a.id
  where lower(a.email)=lower(btrim(p_email))
  limit 1;
end;
$$;
revoke all on function public.resolve_roster_email(text) from public,anon,authenticated;
grant execute on function public.resolve_roster_email(text) to service_role;

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

  select * into v_auth from auth.users where lower(email)=lower(v_invitation.email) for update;
  if not found then raise exception 'No existing account was found' using errcode='P0002'; end if;
  if v_auth.email_confirmed_at is null and v_auth.phone_confirmed_at is null then
    raise exception 'Existing account must verify its email or phone before roster linking' using errcode='42501';
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
      department_id=v_invitation.department_id,full_name=case when btrim(full_name)='' then v_invitation.full_name else full_name end,
      is_active=true,suspended_at=null
    where id=v_auth.id;
  else
    insert into public.users(id,email,full_name,role,organization_id,department_id,is_active)
    values(v_auth.id,lower(v_auth.email),v_invitation.full_name,v_role,v_invitation.organization_id,v_invitation.department_id,true);
  end if;

  if v_role='STUDENT'::public.app_role then
    insert into public.student_directory(organization_id,student_id,student_number,department_id)
    values(v_invitation.organization_id,v_auth.id,v_invitation.student_number,v_invitation.department_id)
    on conflict(organization_id,student_id) do update
    set student_number=excluded.student_number,department_id=excluded.department_id,updated_at=now();

    if nullif(btrim(v_invitation.mobile),'') is not null then
      insert into private.student_contact_profiles(organization_id,student_id,mobile)
      values(v_invitation.organization_id,v_auth.id,v_invitation.mobile)
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
