-- Multi-college tenant foundation, trusted roster invitations, private student contacts and QR identity tokens.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status text not null default 'SETUP_REQUIRED' check (status in ('SETUP_REQUIRED','ACTIVE','SUSPENDED')),
  subscription_status text not null default 'UNCONFIGURED' check (subscription_status in ('UNCONFIGURED','PILOT','ACTIVE','PAST_DUE','CANCELLED')),
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations(name,slug,status,subscription_status)
select 'CoursePulse Setup Workspace','coursepulse-setup','SETUP_REQUIRED','UNCONFIGURED'
where not exists(select 1 from public.organizations);

create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;
revoke all on private.platform_admins from public, anon, authenticated;

alter table public.users add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.courses add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.feedback add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.responses add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.anonymous_submissions add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.departments add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.semesters add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.course_enrollments add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.course_enrollments add column if not exists section text check (section is null or char_length(section) between 1 and 30);
alter table public.instructor_course_assignments add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.audit_logs add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.student_suggestions add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.teacher_notifications add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.monthly_academic_reports add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.monthly_report_settings add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table private.feedback_eligibility add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table private.feedback_versions add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table private.data_deletion_requests add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  update public.users set organization_id=v_org where organization_id is null
    and role='ADMIN'::public.app_role;
  update public.courses set organization_id=v_org where organization_id is null;
  update public.feedback set organization_id=v_org where organization_id is null;
  update public.responses set organization_id=v_org where organization_id is null;
  update public.anonymous_submissions set organization_id=v_org where organization_id is null;
  update public.departments set organization_id=v_org where organization_id is null;
  update public.semesters set organization_id=v_org where organization_id is null;
  update public.course_enrollments set organization_id=v_org where organization_id is null;
  update public.instructor_course_assignments set organization_id=v_org where organization_id is null;
  update public.audit_logs set organization_id=v_org where organization_id is null;
  update public.student_suggestions set organization_id=v_org where organization_id is null;
  update public.teacher_notifications set organization_id=v_org where organization_id is null;
  update public.monthly_academic_reports set organization_id=v_org where organization_id is null;
  update public.monthly_report_settings set organization_id=v_org where organization_id is null;
  update private.feedback_eligibility set organization_id=v_org where organization_id is null;
  update private.feedback_versions set organization_id=v_org where organization_id is null;
  update private.data_deletion_requests set organization_id=v_org where organization_id is null;

  update public.organizations o
     set owner_user_id=first_admin.id,
         status='ACTIVE',
         updated_at=now()
    from (
      select id,organization_id
      from public.users
      where role='ADMIN'::public.app_role and is_active=true and organization_id=v_org
      order by created_at
      limit 1
    ) first_admin
   where o.id=v_org and o.owner_user_id is null;
end
$$;

alter table public.courses alter column organization_id set not null;
alter table public.feedback alter column organization_id set not null;
alter table public.responses alter column organization_id set not null;
alter table public.anonymous_submissions alter column organization_id set not null;
alter table public.departments alter column organization_id set not null;
alter table public.semesters alter column organization_id set not null;
alter table public.course_enrollments alter column organization_id set not null;
alter table public.instructor_course_assignments alter column organization_id set not null;
alter table public.audit_logs alter column organization_id set not null;
alter table public.student_suggestions alter column organization_id set not null;
alter table public.teacher_notifications alter column organization_id set not null;
alter table public.monthly_academic_reports alter column organization_id set not null;
alter table public.monthly_report_settings alter column organization_id set not null;
alter table private.feedback_eligibility alter column organization_id set not null;
alter table private.feedback_versions alter column organization_id set not null;
alter table private.data_deletion_requests alter column organization_id set not null;

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.organization_id
  from public.users u
  join public.organizations o on o.id=u.organization_id and o.status='ACTIVE'
  where u.id=(select auth.uid()) and u.is_active=true
  limit 1
$$;
revoke all on function private.current_organization_id() from public,anon;
grant execute on function private.current_organization_id() to authenticated;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.uid()) is not null
    and (select auth.jwt()->>'aal')='aal2'
    and exists(select 1 from private.platform_admins p where p.user_id=(select auth.uid())),false)
$$;
revoke all on function private.is_platform_admin() from public,anon,authenticated;
grant execute on function private.is_platform_admin() to authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_platform_admin() $$;
revoke all on function public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u
  where u.id=(select auth.uid()) and u.is_active=true
    and u.organization_id is not null
  limit 1
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role()='ADMIN'::public.app_role
    and private.current_organization_id() is not null
    and (select auth.jwt()->>'aal')='aal2',false)
$$;

create or replace function private.is_course_owner(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.is_instructor() and exists (
    select 1 from public.courses c
    where c.id=p_course_id
      and c.organization_id=private.current_organization_id()
      and (
        c.instructor_id=(select auth.uid())
        or exists (
          select 1 from public.instructor_course_assignments a
          where a.course_id=c.id
            and a.organization_id=private.current_organization_id()
            and a.instructor_id=(select auth.uid())
        )
      )
  ),false)
$$;

create unique index if not exists organizations_id_identity on public.organizations(id);
create unique index if not exists users_id_organization_identity on public.users(id,organization_id);
create unique index if not exists departments_id_organization_identity on public.departments(id,organization_id);
create unique index if not exists semesters_id_organization_identity on public.semesters(id,organization_id);
create unique index if not exists courses_id_organization_identity on public.courses(id,organization_id);
create unique index if not exists feedback_id_organization_identity on public.feedback(id,organization_id);

alter table public.departments drop constraint if exists departments_name_key;
alter table public.departments drop constraint if exists departments_code_key;
alter table public.semesters drop constraint if exists semesters_name_key;
create unique index if not exists departments_org_name_key on public.departments(organization_id,name);
create unique index if not exists departments_org_code_key on public.departments(organization_id,code);
create unique index if not exists semesters_org_name_key on public.semesters(organization_id,name);

alter table public.monthly_academic_reports drop constraint if exists monthly_academic_reports_pkey;
alter table public.monthly_academic_reports add constraint monthly_academic_reports_pkey
  primary key (organization_id,report_month,scope_type,scope_id);
alter table public.monthly_report_settings drop constraint if exists monthly_report_settings_pkey;
alter table public.monthly_report_settings add constraint monthly_report_settings_pkey
  primary key (organization_id,id);

alter table public.courses add constraint courses_instructor_org_fkey
  foreign key(instructor_id,organization_id) references public.users(id,organization_id) on delete restrict not valid;
alter table public.courses add constraint courses_department_org_fkey
  foreign key(department_id,organization_id) references public.departments(id,organization_id) on delete set null not valid;
alter table public.courses add constraint courses_semester_org_fkey
  foreign key(semester_id,organization_id) references public.semesters(id,organization_id) on delete set null not valid;
alter table public.feedback add constraint feedback_course_org_fkey
  foreign key(course_id,organization_id) references public.courses(id,organization_id) on delete cascade not valid;
alter table public.feedback add constraint feedback_creator_org_fkey
  foreign key(created_by,organization_id) references public.users(id,organization_id) on delete restrict not valid;
alter table public.course_enrollments add constraint course_enrollments_course_org_fkey
  foreign key(course_id,organization_id) references public.courses(id,organization_id) on delete cascade not valid;
alter table public.course_enrollments add constraint course_enrollments_student_org_fkey
  foreign key(student_id,organization_id) references public.users(id,organization_id) on delete cascade not valid;
alter table public.course_enrollments add constraint course_enrollments_enrolled_by_org_fkey
  foreign key(enrolled_by,organization_id) references public.users(id,organization_id) on delete restrict not valid;
alter table public.instructor_course_assignments add constraint instructor_assignment_course_org_fkey
  foreign key(course_id,organization_id) references public.courses(id,organization_id) on delete cascade not valid;
alter table public.instructor_course_assignments add constraint instructor_assignment_instructor_org_fkey
  foreign key(instructor_id,organization_id) references public.users(id,organization_id) on delete cascade not valid;
alter table public.instructor_course_assignments add constraint instructor_assignment_assigner_org_fkey
  foreign key(assigned_by,organization_id) references public.users(id,organization_id) on delete restrict not valid;
alter table public.responses add constraint responses_feedback_org_fkey
  foreign key(feedback_id,organization_id) references public.feedback(id,organization_id) on delete cascade not valid;
alter table public.responses add constraint responses_student_org_fkey
  foreign key(student_id,organization_id) references public.users(id,organization_id) on delete cascade not valid;
alter table public.anonymous_submissions add constraint anonymous_submissions_feedback_org_fkey
  foreign key(feedback_id,organization_id) references public.feedback(id,organization_id) on delete cascade not valid;
alter table private.feedback_eligibility add constraint feedback_eligibility_feedback_org_fkey
  foreign key(feedback_id,organization_id) references public.feedback(id,organization_id) on delete cascade not valid;
alter table private.feedback_eligibility add constraint feedback_eligibility_student_org_fkey
  foreign key(student_id,organization_id) references public.users(id,organization_id) on delete cascade not valid;

alter table public.student_suggestions add constraint student_suggestions_student_org_fkey
  foreign key(student_id,organization_id) references public.users(id,organization_id) on delete restrict not valid;
alter table public.student_suggestions add constraint student_suggestions_course_org_fkey
  foreign key(course_id,organization_id) references public.courses(id,organization_id) on delete set null not valid;
alter table public.teacher_notifications add constraint teacher_notifications_recipient_org_fkey
  foreign key(recipient_id,organization_id) references public.users(id,organization_id) on delete restrict not valid;
alter table public.teacher_notifications add constraint teacher_notifications_creator_org_fkey
  foreign key(created_by,organization_id) references public.users(id,organization_id) on delete set null not valid;

create table public.student_directory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id() references public.organizations(id) on delete restrict,
  student_id uuid not null,
  student_number text not null check (char_length(btrim(student_number)) between 1 and 40),
  department_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,student_id),
  unique(organization_id,student_number),
  foreign key(student_id,organization_id) references public.users(id,organization_id) on delete restrict,
  foreign key(department_id,organization_id) references public.departments(id,organization_id) on delete set null
);
create index student_directory_department_idx on public.student_directory(organization_id,department_id);
alter table public.student_directory enable row level security;
revoke all on public.student_directory from anon,authenticated;
grant select on public.student_directory to authenticated;
grant insert,update,delete on public.student_directory to authenticated;
create policy student_directory_scoped_read on public.student_directory for select to authenticated
using (
  private.is_admin()
  or student_id=(select auth.uid())
  or exists (
    select 1 from public.course_enrollments e
    where e.student_id=student_directory.student_id
      and e.organization_id=private.current_organization_id()
      and private.is_course_owner(e.course_id)
  )
);
create policy student_directory_head_manage on public.student_directory for all to authenticated
using (private.is_admin()) with check(private.is_admin());

create table private.student_contact_profiles (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null,
  mobile text,
  updated_at timestamptz not null default now(),
  primary key(organization_id,student_id),
  foreign key(student_id,organization_id) references public.users(id,organization_id) on delete cascade
);
alter table private.student_contact_profiles enable row level security;
revoke all on private.student_contact_profiles from public,anon,authenticated;

create table private.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  email text not null,
  full_name text not null check(char_length(btrim(full_name)) between 2 and 120),
  invited_role public.app_role not null check(invited_role in ('STUDENT','INSTRUCTOR','ADMIN')),
  department_id uuid,
  course_ids uuid[] not null default '{}',
  student_number text,
  section text,
  mobile text,
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'PENDING' check(status in ('PENDING','INVITED','ACCEPTED','FAILED','EXPIRED')),
  auth_user_id uuid,
  expires_at timestamptz not null default now()+interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(department_id,organization_id) references public.departments(id,organization_id) on delete set null,
  foreign key(auth_user_id,organization_id) references public.users(id,organization_id) on delete set null,
  check(invited_role<>'STUDENT' or student_number is not null),
  check(invited_role<>'INSTRUCTOR' or cardinality(course_ids)>0),
  check(invited_role<>'STUDENT' or cardinality(course_ids)>0)
);
create unique index organization_invitations_pending_email
  on private.organization_invitations(organization_id,lower(email))
  where status in ('PENDING','INVITED');
alter table private.organization_invitations enable row level security;
revoke all on private.organization_invitations from public,anon,authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation private.organization_invitations%rowtype;
  v_has_invitation boolean := false;
  v_user_name text;
  v_course uuid;
begin
  select * into v_invitation
  from private.organization_invitations i
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
    update private.organization_invitations
    set status='ACCEPTED',auth_user_id=NEW.id,updated_at=now()
    where id=v_invitation.id;

    if v_invitation.invited_role='STUDENT'::public.app_role then
      insert into public.student_directory(organization_id,student_id,student_number,department_id)
      values(v_invitation.organization_id,NEW.id,v_invitation.student_number,v_invitation.department_id)
      on conflict(organization_id,student_id) do update
      set student_number=excluded.student_number,department_id=excluded.department_id,updated_at=now();

      if nullif(btrim(v_invitation.mobile),'') is not null then
        insert into private.student_contact_profiles(organization_id,student_id,mobile)
        values(v_invitation.organization_id,NEW.id,v_invitation.mobile)
        on conflict(organization_id,student_id) do update set mobile=excluded.mobile,updated_at=now();
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
  set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)-'admin_signup_code'-'requested_role'-'organization_id'-'role'
  where id=NEW.id;

  return NEW;
end;
$$;

create or replace function private.current_student_directory_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sd.id from public.student_directory sd
  where sd.student_id=(select auth.uid())
    and sd.organization_id=private.current_organization_id()
  limit 1
$$;
revoke all on function private.current_student_directory_id() from public,anon;
grant execute on function private.current_student_directory_id() to authenticated;

create table private.student_id_qr_tokens (
  token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  foreign key(student_id,organization_id) references public.users(id,organization_id) on delete cascade,
  check(expires_at>issued_at)
);
create index student_id_qr_tokens_student_idx
  on private.student_id_qr_tokens(organization_id,student_id,expires_at desc);
alter table private.student_id_qr_tokens enable row level security;
revoke all on private.student_id_qr_tokens from public,anon,authenticated;

create or replace function private.register_student_card_token(p_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_role public.app_role := private.current_app_role();
  v_expiry timestamptz := now()+interval '90 days';
begin
  if (select auth.uid()) is null or v_org is null or v_role<>'STUDENT'::public.app_role then
    raise exception 'Student authentication is required' using errcode='42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid verification token' using errcode='22023';
  end if;
  if not exists(select 1 from public.student_directory d where d.organization_id=v_org and d.student_id=(select auth.uid())) then
    raise exception 'Student record is not provisioned by the college' using errcode='P0002';
  end if;
  update private.student_id_qr_tokens set revoked_at=now()
   where organization_id=v_org and student_id=(select auth.uid()) and revoked_at is null;
  insert into private.student_id_qr_tokens(token_hash,organization_id,student_id,expires_at)
  values(p_token_hash,v_org,(select auth.uid()),v_expiry);
  return v_expiry;
end;
$$;
revoke all on function private.register_student_card_token(text) from public,anon,authenticated;

create or replace function public.register_student_card_token(p_token_hash text)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$ select private.register_student_card_token(p_token_hash) $$;
revoke all on function public.register_student_card_token(text) from public,anon;
grant execute on function public.register_student_card_token(text) to authenticated;

create or replace function public.verify_student_card(p_token_hash text)
returns table(
  student_name text,
  student_number text,
  college_name text,
  enrollment_sections text[],
  valid_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
  return query
  select u.full_name,d.student_number,o.name,
    coalesce(array_agg(distinct nullif(e.section,'') order by nullif(e.section,'')) filter(where nullif(e.section,'') is not null),'{}'::text[]),
    t.expires_at
  from private.student_id_qr_tokens t
  join public.users u on u.id=t.student_id and u.organization_id=t.organization_id and u.is_active=true
  join public.organizations o on o.id=t.organization_id and o.status='ACTIVE'
  join public.student_directory d on d.organization_id=t.organization_id and d.student_id=t.student_id
  left join public.course_enrollments e on e.organization_id=t.organization_id and e.student_id=t.student_id
  where t.token_hash=p_token_hash and t.revoked_at is null and t.expires_at>now()
  group by u.full_name,d.student_number,o.name,t.expires_at;
end;
$$;
revoke all on function public.verify_student_card(text) from public;
grant execute on function public.verify_student_card(text) to anon,authenticated;

create or replace function private.admin_record_audit(
  p_action text,p_target_type text,p_target_id uuid,p_details jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() or (select auth.jwt()->>'aal')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  if p_action is null or char_length(p_action) not between 2 and 80
    or p_target_type is null or char_length(p_target_type) not between 2 and 80
    or p_details is null or jsonb_typeof(p_details)<>'object' or pg_column_size(p_details)>4096 then
    raise exception 'Invalid audit event' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_id,action,target_type,target_id,details,organization_id)
  values((select auth.uid()),p_action,p_target_type,p_target_id,p_details,private.current_organization_id());
end;
$$;

create or replace function private.admin_update_user(p_user_id uuid,p_role public.app_role,p_is_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_old_role public.app_role;
  v_old_active boolean;
begin
  if not private.is_admin() or (auth.jwt()->>'aal')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  select role,is_active into v_old_role,v_old_active
  from public.users where id=p_user_id and organization_id=v_org for update;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;
  if p_user_id=(select auth.uid()) and (p_role<>'ADMIN'::public.app_role or not p_is_active) then
    raise exception 'You cannot remove your own active administrator access' using errcode='42501';
  end if;
  if v_old_role='ADMIN'::public.app_role and v_old_active and (p_role<>'ADMIN'::public.app_role or not p_is_active)
    and (select count(*) from public.users where organization_id=v_org and role='ADMIN'::public.app_role and is_active=true)<=1 then
    raise exception 'The last active administrator cannot be demoted or suspended' using errcode='23514';
  end if;
  update public.users set role=p_role,is_active=p_is_active,
    suspended_at=case when p_is_active then null else coalesce(suspended_at,now()) end
  where id=p_user_id and organization_id=v_org;
  perform private.admin_record_audit('user.access.updated','user',p_user_id,
    jsonb_build_object('old_role',v_old_role,'new_role',p_role,'was_active',v_old_active,'is_active',p_is_active));
end;
$$;

create or replace function private.admin_assign_user_department(p_user_id uuid,p_department_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.current_organization_id();
  v_old_department uuid;
begin
  if not private.is_admin() or (select auth.jwt()->>'aal')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  select department_id into v_old_department
  from public.users where id=p_user_id and organization_id=v_org for update;
  if not found then raise exception 'User not found in this college' using errcode='P0002'; end if;
  if p_department_id is not null and not exists(
    select 1 from public.departments d where d.id=p_department_id and d.organization_id=v_org
  ) then raise exception 'Department not found in this college' using errcode='P0002'; end if;
  update public.users set department_id=p_department_id where id=p_user_id and organization_id=v_org;
  perform private.admin_record_audit('user.department.updated','user',p_user_id,
    jsonb_build_object('old_department_id',v_old_department,'new_department_id',p_department_id));
end;
$$;

create or replace function private.has_consumed_feedback_eligibility(p_feedback_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.uid()) is not null and exists(
    select 1 from private.feedback_eligibility e
    join public.feedback f on f.id=e.feedback_id and f.organization_id=e.organization_id
    where e.feedback_id=p_feedback_id and e.student_id=(select auth.uid())
      and e.consumed=true and e.organization_id=private.current_organization_id()
  ),false)
$$;

create or replace function private.submit_anonymous_feedback(p_feedback_id uuid,p_answers jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id uuid := (select auth.uid());
  v_org uuid := private.current_organization_id();
  v_claimed boolean;
  v_form_schema jsonb;
  v_question jsonb;
  v_value jsonb;
begin
  if v_student_id is null or v_org is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role()<>'STUDENT'::public.app_role then raise exception 'Only students can submit feedback' using errcode='42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or pg_column_size(p_answers)>32768 then raise exception 'Invalid answer payload' using errcode='22023'; end if;
  select f.form_schema into v_form_schema
  from public.feedback f
  join public.courses c on c.id=f.course_id and c.organization_id=f.organization_id
  join public.course_enrollments e on e.course_id=c.id and e.organization_id=c.organization_id and e.student_id=v_student_id
  where f.id=p_feedback_id and f.organization_id=v_org and c.organization_id=v_org
    and f.is_open=true and c.status='PUBLISHED'::public.course_status;
  if v_form_schema is null then raise exception 'Feedback form is closed or unavailable to this student' using errcode='P0002'; end if;
  if jsonb_typeof(v_form_schema)<>'array' or jsonb_array_length(v_form_schema)<1 or jsonb_array_length(v_form_schema)>30 then raise exception 'Feedback form schema is invalid' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_answers) keys(answer_key)
    where not exists(select 1 from jsonb_array_elements(v_form_schema) q(value) where q.value->>'id'=answer_key)) then
    raise exception 'Response contains an unknown question' using errcode='22023';
  end if;
  for v_question in select value from jsonb_array_elements(v_form_schema) loop
    v_value:=p_answers->(v_question->>'id');
    if coalesce((v_question->>'required')::boolean,true) and (v_value is null or v_value='null'::jsonb or v_value='""'::jsonb) then
      raise exception 'A required question is unanswered' using errcode='22023';
    end if;
    if v_value is null or v_value='null'::jsonb or v_value='""'::jsonb then continue; end if;
    case v_question->>'type'
      when 'rating' then
        if jsonb_typeof(v_value)<>'number' or (v_value#>>'{}') !~ '^[0-9]+$' or (v_value#>>'{}')::numeric not between 1 and 5 then raise exception 'Rating must be a whole number from 1 to 5' using errcode='22023'; end if;
      when 'number' then
        if jsonb_typeof(v_value)<>'number' or (v_value#>>'{}') !~ '^-?[0-9]+([.][0-9]+)?$' or abs((v_value#>>'{}')::numeric)>1000000 then raise exception 'Numeric answer is invalid' using errcode='22023'; end if;
      when 'text','textarea' then
        if jsonb_typeof(v_value)<>'string' or char_length(v_value#>>'{}')>2000 then raise exception 'Written answer is invalid' using errcode='22023'; end if;
      when 'yes_no' then
        if jsonb_typeof(v_value)<>'string' or v_value#>>'{}' not in ('Yes','No') then raise exception 'Yes/No answers must be Yes or No' using errcode='22023'; end if;
      when 'single_choice' then
        if jsonb_typeof(v_value)<>'string' or jsonb_typeof(v_question->'options')<>'array'
          or not exists(select 1 from jsonb_array_elements_text(v_question->'options') o(value) where o.value=v_value#>>'{}') then
          raise exception 'Choice answer is invalid' using errcode='22023';
        end if;
      when 'multiple_choice','multiple_select' then
        if jsonb_typeof(v_value)<>'array' or jsonb_typeof(v_question->'options')<>'array'
          or jsonb_array_length(v_value)>20
          or (coalesce((v_question->>'required')::boolean,true) and jsonb_array_length(v_value)=0)
          or exists(select 1 from jsonb_array_elements(v_value) a(value)
            where jsonb_typeof(a.value)<>'string' or not exists(select 1 from jsonb_array_elements_text(v_question->'options') o(value) where o.value=a.value#>>'{}')) then
          raise exception 'Multiple-choice answer is invalid' using errcode='22023';
        end if;
      else raise exception 'Unsupported question type' using errcode='22023';
    end case;
  end loop;
  insert into private.feedback_eligibility(feedback_id,student_id,organization_id)
  values(p_feedback_id,v_student_id,v_org) on conflict(feedback_id,student_id) do nothing;
  update private.feedback_eligibility set consumed=true
  where feedback_id=p_feedback_id and student_id=v_student_id and organization_id=v_org and consumed=false
  returning true into v_claimed;
  if coalesce(v_claimed,false)=false then raise exception 'Feedback already submitted' using errcode='23505'; end if;
  insert into public.anonymous_submissions(feedback_id,answers,organization_id)
  values(p_feedback_id,p_answers,v_org);
end;
$$;

create or replace function public.verify_student_card(p_token_hash text)
returns table(student_name text,student_number text,college_name text,enrollment_sections text[],valid_until timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
  return query
  select u.full_name,d.student_number,o.name,
    coalesce(array_agg(distinct nullif(e.section,'') order by nullif(e.section,'')) filter(where nullif(e.section,'') is not null),'{}'::text[]),
    t.expires_at
  from private.student_id_qr_tokens t
  join public.users u on u.id=t.student_id and u.organization_id=t.organization_id and u.is_active=true
  join public.organizations o on o.id=t.organization_id and o.status='ACTIVE'
  join public.student_directory d on d.organization_id=t.organization_id and d.student_id=t.student_id
  left join public.course_enrollments e on e.organization_id=t.organization_id and e.student_id=t.student_id
  where t.token_hash=p_token_hash and t.revoked_at is null and t.expires_at>now()
  group by u.full_name,d.student_number,o.name,t.expires_at;
end;
$$;
revoke all on function public.verify_student_card(text) from public;
grant execute on function public.verify_student_card(text) to anon,authenticated;

create or replace function public.admin_claim_setup_workspace(p_code text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_verified boolean;
  v_hash bytea;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select (email_confirmed_at is not null or phone_confirmed_at is not null)
  into v_verified from auth.users where id=v_user;
  if not coalesce(v_verified,false) then raise exception 'Verify your email or mobile first' using errcode='42501'; end if;
  perform private.consume_api_rate_limit('admin-signup:claim',5,900);
  select id into v_org from public.organizations
  where status='SETUP_REQUIRED' and owner_user_id is null
  order by created_at limit 1 for update;
  if v_org is null then raise exception 'No unclaimed college workspace is available' using errcode='42501'; end if;
  select code_sha256 into v_hash from private.admin_signup_settings where singleton=true;
  if v_hash is null or extensions.digest(p_code,'sha256') is distinct from v_hash then
    raise exception 'Invalid administrator signup code' using errcode='42501';
  end if;
  update public.users set role='ADMIN'::public.app_role,organization_id=v_org
  where id=v_user and role='STUDENT'::public.app_role and organization_id is null;
  if not found then raise exception 'This account cannot claim the college workspace' using errcode='42501'; end if;
  update public.organizations set owner_user_id=v_user,status='ACTIVE',updated_at=now() where id=v_org;
  update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('role','ADMIN')
  where id=v_user;
  perform private.admin_record_audit('organization.first_head_claimed','organization',v_org,jsonb_build_object('owner_user_id',v_user));
end;
$$;
revoke all on function public.admin_claim_setup_workspace(text) from public,anon;
grant execute on function public.admin_claim_setup_workspace(text) to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
 select coalesce(private.current_app_role()='ADMIN'::public.app_role
 and private.current_organization_id() is not null
 and (select auth.jwt()->>'aal')='aal2',false)
$$;

alter table public.organizations enable row level security;
revoke all on public.organizations from anon,authenticated;
grant select,update on public.organizations to authenticated;
create policy organizations_current_read on public.organizations for select to authenticated
using(id=private.current_organization_id() or private.is_platform_admin());
create policy organizations_admin_update on public.organizations for update to authenticated
using(private.is_admin() and id=private.current_organization_id())
with check(private.is_admin() and id=private.current_organization_id());
create policy organizations_platform_insert on public.organizations for insert to authenticated
with check(private.is_platform_admin());

alter table public.users enable row level security;
create policy users_tenant_boundary on public.users as restrictive for all to authenticated
using(organization_id=private.current_organization_id() or id=(select auth.uid()))
with check(organization_id=private.current_organization_id() or (id=(select auth.uid()) and organization_id is null));

do $$
declare t text;
begin
  foreach t in array array[
    'courses','feedback','responses','anonymous_submissions','departments','semesters',
    'course_enrollments','instructor_course_assignments','audit_logs','student_suggestions',
    'teacher_notifications','monthly_academic_reports','monthly_report_settings','student_directory'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (organization_id=private.current_organization_id()) with check (organization_id=private.current_organization_id())',t||'_tenant_boundary',t);
  end loop;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['feedback_eligibility','feedback_versions','data_deletion_requests','student_contact_profiles','student_id_qr_tokens'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('create policy %I on private.%I as restrictive for all to authenticated using (organization_id=private.current_organization_id()) with check (organization_id=private.current_organization_id())',t||'_tenant_boundary',t);
  end loop;
end
$$;

alter table public.courses alter column organization_id set default private.current_organization_id();
alter table public.feedback alter column organization_id set default private.current_organization_id();
alter table public.responses alter column organization_id set default private.current_organization_id();
alter table public.anonymous_submissions alter column organization_id set default private.current_organization_id();
alter table public.departments alter column organization_id set default private.current_organization_id();
alter table public.semesters alter column organization_id set default private.current_organization_id();
alter table public.course_enrollments alter column organization_id set default private.current_organization_id();
alter table public.instructor_course_assignments alter column organization_id set default private.current_organization_id();
alter table public.audit_logs alter column organization_id set default private.current_organization_id();
alter table public.student_suggestions alter column organization_id set default private.current_organization_id();
alter table public.teacher_notifications alter column organization_id set default private.current_organization_id();
alter table public.monthly_academic_reports alter column organization_id set default private.current_organization_id();
alter table public.monthly_report_settings alter column organization_id set default private.current_organization_id();
alter table private.feedback_eligibility alter column organization_id set default private.current_organization_id();
alter table private.feedback_versions alter column organization_id set default private.current_organization_id();
alter table private.data_deletion_requests alter column organization_id set default private.current_organization_id();

create or replace function private.cleanup_expired_responses()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.responses r using public.feedback f
  where r.feedback_id=f.id and r.submitted_at < now() - make_interval(days=>f.retention_days);
  delete from public.anonymous_submissions s using public.feedback f
  where s.feedback_id=f.id and s.received_on < (current_date - make_interval(days=>f.retention_days));
  delete from private.api_rate_limits where window_start < now()-interval '2 days';
end;
$$;

comment on table public.organizations is 'College tenant registry. Subscription state is metadata only; no billing provider is configured.';
comment on table public.student_directory is 'Head and assigned-teacher roster fields. Mobile numbers are kept in private.student_contact_profiles.';
comment on table private.organization_invitations is 'Trusted server-created invitations. Role and tenant are taken from this table, never from user-editable Auth metadata.';
comment on table private.student_id_qr_tokens is 'Only SHA-256 hashes of random student-card bearer tokens are stored; public verification discloses only card fields.';
