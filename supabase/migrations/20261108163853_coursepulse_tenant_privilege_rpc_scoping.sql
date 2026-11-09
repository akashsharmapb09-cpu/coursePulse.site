-- Explicit tenant scoping for privileged RPCs, monthly jobs and roster readers.
create table public.organization_invitations (
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
  foreign key(department_id,organization_id) references public.departments(id,organization_id) on delete restrict,
  foreign key(auth_user_id) references auth.users(id) on delete set null,
  check(invited_role<>'STUDENT' or student_number is not null),
  check(invited_role<>'INSTRUCTOR' or cardinality(course_ids)>0),
  check(invited_role<>'STUDENT' or cardinality(course_ids)>0)
);
create unique index organization_invitations_pending_email
  on public.organization_invitations(organization_id,lower(email))
  where status in ('PENDING','INVITED');
alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from public,anon,authenticated;
create policy organization_invitations_tenant_deny on public.organization_invitations
  as restrictive for all to authenticated using (false) with check(false);
comment on table public.organization_invitations is
  'Server-only invitation ledger; role and tenant are consumed by the Auth trigger and never come from client metadata.';

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
          status='ACTIVE',
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

create or replace function private.get_admin_dashboard_overview()
returns table(
  total_students bigint,total_instructors bigint,total_courses bigint,total_departments bigint,
  total_feedback_forms bigint,total_responses bigint,participation_rate numeric,average_rating numeric,
  low_participation_forms jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_org uuid := private.current_organization_id();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not private.is_admin() or coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  return query
  with all_responses as (
    select r.id,r.feedback_id,r.answers,r.organization_id from public.responses r where r.organization_id=v_org
    union all
    select a.id,a.feedback_id,a.answers,a.organization_id from public.anonymous_submissions a where a.organization_id=v_org
  ),
  response_counts as (
    select r.feedback_id,count(*)::bigint response_count from all_responses r
    group by r.feedback_id
  ),
  form_cohorts as (
    select f.id feedback_id,f.title feedback_title,c.title course_title,f.is_open,f.due_at,
      count(distinct e.student_id)::bigint enrolled_count,coalesce(rc.response_count,0)::bigint response_count
    from public.feedback f
    join public.courses c on c.id=f.course_id and c.organization_id=v_org
    left join public.course_enrollments e on e.course_id=c.id and e.organization_id=v_org
    left join response_counts rc on rc.feedback_id=f.id
    where f.organization_id=v_org
    group by f.id,f.title,c.title,f.is_open,f.due_at,rc.response_count
  ),
  rating_answers as (
    select f.id feedback_id,q.value->>'id' question_id,(r.answers->>(q.value->>'id'))::numeric score
    from public.feedback f
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    join all_responses r on r.feedback_id=f.id and r.organization_id=v_org
    where f.organization_id=v_org and q.value->>'type'='rating'
      and jsonb_typeof(r.answers->(q.value->>'id'))='number'
      and (r.answers->>(q.value->>'id')) ~ '^[1-5]$'
  ),
  reportable_rating_questions as (
    select feedback_id,question_id from rating_answers group by feedback_id,question_id having count(*)>=5
  )
  select
    (select count(*) from public.users where organization_id=v_org and role='STUDENT'::public.app_role and is_active=true)::bigint,
    (select count(*) from public.users where organization_id=v_org and role='INSTRUCTOR'::public.app_role and is_active=true)::bigint,
    (select count(*) from public.courses where organization_id=v_org)::bigint,
    (select count(*) from public.departments where organization_id=v_org)::bigint,
    (select count(*) from public.feedback where organization_id=v_org)::bigint,
    coalesce((select sum(response_count) from response_counts),0)::bigint,
    (select round(sum(fc.response_count)::numeric*100/nullif(sum(fc.enrolled_count),0),1) from form_cohorts fc),
    (select round(avg(ra.score),2) from rating_answers ra join reportable_rating_questions rq using(feedback_id,question_id)),
    coalesce((
      select jsonb_agg(jsonb_build_object('feedback_id',a.feedback_id,'feedback_title',a.feedback_title,
        'course_title',a.course_title,'message','Fewer than five submissions') order by a.feedback_title)
      from (select fc.feedback_id,fc.feedback_title,fc.course_title from form_cohorts fc
        where fc.is_open=true and (fc.due_at is null or fc.due_at>now())
          and fc.enrolled_count>=5 and fc.response_count<5
        order by fc.feedback_title limit 10) a
    ),'[]'::jsonb);
end;
$$;

create or replace function private.get_instructor_aggregates(p_course_id uuid default null)
returns table(course_id uuid,course_title text,feedback_id uuid,feedback_title text,question_id text,
  question_label text,question_type text,option_value text,response_count bigint,avg_numeric_value numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode='42501';
  end if;
  return query
  with all_responses as (
    select r.id,r.feedback_id,r.answers,r.organization_id from public.responses r where r.organization_id=private.current_organization_id()
    union all
    select a.id,a.feedback_id,a.answers,a.organization_id from public.anonymous_submissions a where a.organization_id=private.current_organization_id()
  ),
  question_values as (
    select c.id c_id,c.title c_title,f.id f_id,f.title f_title,q.value->>'id' q_id,q.value->>'label' q_label,
      q.value->>'type' q_type,r.id response_id,a.answer_value
    from public.courses c
    join public.feedback f on f.course_id=c.id and f.organization_id=c.organization_id
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    left join all_responses r on r.feedback_id=f.id and r.organization_id=c.organization_id
    left join lateral (
      select jsonb_array_elements_text(r.answers->(q.value->>'id')) answer_value
      where jsonb_typeof(r.answers->(q.value->>'id'))='array'
      union all
      select r.answers->>(q.value->>'id') answer_value
      where r.answers ? (q.value->>'id') and jsonb_typeof(r.answers->(q.value->>'id'))<>'array'
    ) a on true
    where c.organization_id=private.current_organization_id()
      and (p_course_id is null or c.id=p_course_id)
      and (private.is_admin() or (private.is_instructor() and private.is_course_owner(c.id)))
  ), normalised as (
    select q.*,
      case when q_type in ('text','textarea','long_text','rating','number') then null::text else answer_value end grouped_option,
      case when q_type in ('rating','number') and answer_value ~ '^-?[0-9]+(\.[0-9]+)?$'
        then answer_value::numeric else null::numeric end numeric_answer
    from question_values q
  )
  select n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option,
    count(distinct n.response_id)::bigint,
    case when n.q_type in ('rating','number') then avg(n.numeric_answer) else null::numeric end
  from normalised n group by n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option
  having count(distinct n.response_id)>=5;
end;
$$;

create or replace function private.get_instructor_aggregates_filtered(
  p_course_id uuid default null,p_from_date date default null,p_to_date date default null,
  p_semester_id uuid default null,p_department_id uuid default null
)
returns table(course_id uuid,course_title text,feedback_id uuid,feedback_title text,question_id text,
  question_label text,question_type text,option_value text,response_count bigint,avg_numeric_value numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode='42501';
  end if;
  return query
  with all_responses as (
    select r.id,r.feedback_id,r.answers,r.submitted_at::date submitted_on,r.organization_id
    from public.responses r where r.organization_id=private.current_organization_id()
    union all
    select a.id,a.feedback_id,a.answers,a.received_on submitted_on,a.organization_id
    from public.anonymous_submissions a where a.organization_id=private.current_organization_id()
  ), question_values as (
    select c.id c_id,c.title c_title,f.id f_id,f.title f_title,q.value->>'id' q_id,q.value->>'label' q_label,
      q.value->>'type' q_type,r.id response_id,r.submitted_on,a.answer_value
    from public.courses c
    join public.feedback f on f.course_id=c.id and f.organization_id=c.organization_id
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    left join all_responses r on r.feedback_id=f.id and r.organization_id=c.organization_id
    left join lateral (
      select jsonb_array_elements_text(r.answers->(q.value->>'id')) answer_value
      where jsonb_typeof(r.answers->(q.value->>'id'))='array'
      union all
      select r.answers->>(q.value->>'id') answer_value
      where r.answers ? (q.value->>'id') and jsonb_typeof(r.answers->(q.value->>'id'))<>'array'
    ) a on true
    where c.organization_id=private.current_organization_id()
      and (p_course_id is null or c.id=p_course_id)
      and (p_from_date is null or r.submitted_on>=p_from_date)
      and (p_to_date is null or r.submitted_on<=p_to_date)
      and (p_semester_id is null or c.semester_id=p_semester_id)
      and (p_department_id is null or c.department_id=p_department_id)
      and (private.is_admin() or (private.is_instructor() and private.is_course_owner(c.id)))
  ), normalised as (
    select q.*,
      case when q_type in ('text','textarea','long_text','rating','number') then null::text else answer_value end grouped_option,
      case when q_type in ('rating','number') and answer_value ~ '^-?[0-9]+(\.[0-9]+)?$'
        then answer_value::numeric else null::numeric end numeric_answer
    from question_values q
  )
  select n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option,
    count(distinct n.response_id)::bigint,
    case when n.q_type in ('rating','number') then avg(n.numeric_answer) else null::numeric end
  from normalised n group by n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option
  having count(distinct n.response_id)>=5;
end;
$$;

create or replace function private.get_instructor_rating_distribution_filtered(
  p_course_id uuid default null,p_from_date date default null,p_to_date date default null,
  p_semester_id uuid default null,p_department_id uuid default null
)
returns table(course_id uuid,course_title text,feedback_id uuid,feedback_title text,question_id text,
  question_label text,rating_value integer,response_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode='42501';
  end if;
  return query
  with all_responses as (
    select r.id,r.feedback_id,r.answers,r.submitted_at::date submitted_on,r.organization_id
    from public.responses r where r.organization_id=private.current_organization_id()
    union all
    select a.id,a.feedback_id,a.answers,a.received_on submitted_on,a.organization_id
    from public.anonymous_submissions a where a.organization_id=private.current_organization_id()
  )
  select c.id,c.title,f.id,f.title,q.value->>'id',q.value->>'label',
    (r.answers->>(q.value->>'id'))::integer,count(distinct r.id)::bigint
  from public.courses c
  join public.feedback f on f.course_id=c.id and f.organization_id=c.organization_id
  cross join lateral jsonb_array_elements(f.form_schema) q(value)
  join all_responses r on r.feedback_id=f.id and r.organization_id=c.organization_id
  where c.organization_id=private.current_organization_id()
    and q.value->>'type'='rating' and jsonb_typeof(r.answers->(q.value->>'id'))='number'
    and (r.answers->>(q.value->>'id')) ~ '^[1-5]$'
    and (p_course_id is null or c.id=p_course_id)
    and (p_from_date is null or r.submitted_on>=p_from_date)
    and (p_to_date is null or r.submitted_on<=p_to_date)
    and (p_semester_id is null or c.semester_id=p_semester_id)
    and (p_department_id is null or c.department_id=p_department_id)
    and (private.is_admin() or (private.is_instructor() and private.is_course_owner(c.id)))
  group by c.id,c.title,f.id,f.title,q.value->>'id',q.value->>'label',(r.answers->>(q.value->>'id'))::integer
  having count(distinct r.id)>=5;
end;
$$;

create or replace function private.get_instructor_response_trends_filtered(
  p_course_id uuid default null,p_from_date date default null,p_to_date date default null,
  p_semester_id uuid default null,p_department_id uuid default null
)
returns table(course_id uuid,course_title text,week_start date,response_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode='42501';
  end if;
  return query
  with all_responses as (
    select r.id,r.feedback_id,r.submitted_at,r.organization_id from public.responses r where r.organization_id=private.current_organization_id()
    union all
    select a.id,a.feedback_id,a.received_on::timestamp,a.organization_id from public.anonymous_submissions a where a.organization_id=private.current_organization_id()
  )
  select c.id,c.title,date_trunc('week',r.submitted_at)::date,count(distinct r.id)::bigint
  from public.courses c
  join public.feedback f on f.course_id=c.id and f.organization_id=c.organization_id
  join all_responses r on r.feedback_id=f.id and r.organization_id=c.organization_id
  where c.organization_id=private.current_organization_id()
    and (p_course_id is null or c.id=p_course_id)
    and (p_from_date is null or r.submitted_at::date>=p_from_date)
    and (p_to_date is null or r.submitted_at::date<=p_to_date)
    and (p_semester_id is null or c.semester_id=p_semester_id)
    and (p_department_id is null or c.department_id=p_department_id)
    and (private.is_admin() or (private.is_instructor() and private.is_course_owner(c.id)))
  group by c.id,c.title,date_trunc('week',r.submitted_at)::date
  having count(distinct r.id)>=5;
end;
$$;

create or replace function private.get_feedback_versions(p_feedback_id uuid)
returns table(version integer,title text,description text,form_schema jsonb,due_at timestamptz,changed_by uuid,created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_course_id uuid;
begin
  select f.course_id into v_course_id from public.feedback f
  where f.id=p_feedback_id and f.organization_id=private.current_organization_id();
  if not found then raise exception 'Feedback form not found' using errcode='P0002'; end if;
  if not private.is_admin() and not private.is_course_owner(v_course_id) then
    raise exception 'Feedback owner or administrator access required' using errcode='42501';
  end if;
  return query select v.version,v.title,v.description,v.form_schema,v.due_at,v.changed_by,v.created_at
  from private.feedback_versions v
  where v.feedback_id=p_feedback_id and v.organization_id=private.current_organization_id()
  order by v.version desc;
end;
$$;

create or replace function private.restore_feedback_version(p_feedback_id uuid,p_version integer)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_course_id uuid;v_title text;v_description text;v_schema jsonb;v_due timestamptz;v_new integer;
begin
  select f.course_id into v_course_id from public.feedback f
  where f.id=p_feedback_id and f.organization_id=private.current_organization_id() for update;
  if not found then raise exception 'Feedback form not found' using errcode='P0002'; end if;
  if not private.is_admin() and not private.is_course_owner(v_course_id) then
    raise exception 'Feedback owner or administrator access required' using errcode='42501';
  end if;
  select title,description,form_schema,due_at into v_title,v_description,v_schema,v_due
  from private.feedback_versions
  where feedback_id=p_feedback_id and version=p_version and organization_id=private.current_organization_id();
  if not found then raise exception 'Feedback version not found' using errcode='P0002'; end if;
  update public.feedback set title=v_title,description=v_description,form_schema=v_schema,due_at=v_due
  where id=p_feedback_id and organization_id=private.current_organization_id()
  returning version into v_new;
  return v_new;
end;
$$;

create or replace function private.get_student_course_instructors()
returns table(course_id uuid,instructor_name text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_student uuid := (select auth.uid());v_org uuid:=private.current_organization_id();
begin
  if v_student is null or v_org is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role()<>'STUDENT'::public.app_role then raise exception 'Student role required' using errcode='42501'; end if;
  return query
  with accessible_courses as (
    select c.id course_id,c.instructor_id from public.courses c
    join public.course_enrollments e on e.course_id=c.id and e.organization_id=v_org and e.student_id=v_student
    where c.organization_id=v_org and c.status='PUBLISHED'::public.course_status
    union
    select c.id course_id,a.instructor_id from public.courses c
    join public.course_enrollments e on e.course_id=c.id and e.organization_id=v_org and e.student_id=v_student
    join public.instructor_course_assignments a on a.course_id=c.id and a.organization_id=v_org
    where c.organization_id=v_org and c.status='PUBLISHED'::public.course_status
  )
  select distinct ac.course_id,nullif(btrim(u.full_name),'')
  from accessible_courses ac join public.users u on u.id=ac.instructor_id and u.organization_id=v_org
  where u.is_active=true and nullif(btrim(u.full_name),'') is not null;
end;
$$;

create or replace function private.get_student_feedback_status()
returns table(feedback_id uuid,submitted boolean)
language sql stable security definer set search_path = ''
as $$
  select f.id,coalesce(e.consumed,false)
  from public.feedback f
  join public.courses c on c.id=f.course_id and c.organization_id=f.organization_id
  join public.course_enrollments ce on ce.course_id=c.id and ce.organization_id=c.organization_id and ce.student_id=(select auth.uid())
  left join private.feedback_eligibility e on e.feedback_id=f.id and e.student_id=(select auth.uid()) and e.organization_id=f.organization_id
  where f.organization_id=private.current_organization_id()
    and c.status='PUBLISHED'::public.course_status
    and private.current_app_role()='STUDENT'::public.app_role
$$;

create or replace function private.create_my_data_deletion_request()
returns table(id uuid,status text,created_at timestamptz,reviewed_at timestamptz,resolution_note text)
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid:=(select auth.uid());v_org uuid:=private.current_organization_id();
begin
  if v_user is null or v_org is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.users u where u.id=v_user and u.organization_id=v_org and u.is_active=true) then
    raise exception 'Active account required' using errcode='42501';
  end if;
  insert into private.data_deletion_requests(requester_id,organization_id) values(v_user,v_org);
  return query select r.id,r.status,r.created_at,r.reviewed_at,r.resolution_note
  from private.data_deletion_requests r where r.requester_id=v_user and r.organization_id=v_org
  order by r.created_at desc limit 1;
end;
$$;

create or replace function private.get_my_data_deletion_requests()
returns table(id uuid,status text,created_at timestamptz,reviewed_at timestamptz,resolution_note text)
language sql stable security definer set search_path = ''
as $$
  select r.id,r.status,r.created_at,r.reviewed_at,r.resolution_note
  from private.data_deletion_requests r
  where r.requester_id=(select auth.uid()) and r.organization_id=private.current_organization_id()
  order by r.created_at desc limit 20
$$;

create or replace function private.admin_list_data_deletion_requests()
returns table(id uuid,requester_id uuid,requester_name text,requester_email text,requester_role public.app_role,
  status text,created_at timestamptz,reviewed_at timestamptz,reviewed_by uuid,resolution_note text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() or coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  return query
  select r.id,r.requester_id,u.full_name,u.email,u.role,r.status,r.created_at,r.reviewed_at,r.reviewed_by,r.resolution_note
  from private.data_deletion_requests r
  left join public.users u on u.id=r.requester_id and u.organization_id=r.organization_id
  where r.organization_id=private.current_organization_id()
  order by r.created_at desc limit 100;
end;
$$;

create or replace function private.admin_review_data_deletion_request(p_request_id uuid,p_status text,p_resolution_note text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_current_status text;v_org uuid:=private.current_organization_id();v_requester uuid;
begin
  if not private.is_admin() or coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  if p_status not in ('IN_REVIEW','APPROVED','REJECTED','COMPLETED')
    or p_resolution_note is null or char_length(p_resolution_note)>500 then
    raise exception 'Invalid deletion request review' using errcode='22023';
  end if;
  select r.status,r.requester_id into v_current_status,v_requester
  from private.data_deletion_requests r
  where r.id=p_request_id and r.organization_id=v_org for update;
  if not found then raise exception 'Deletion request not found' using errcode='P0002'; end if;
  if not ((v_current_status='PENDING' and p_status in ('IN_REVIEW','APPROVED','REJECTED'))
    or (v_current_status='IN_REVIEW' and p_status in ('APPROVED','REJECTED'))
    or (v_current_status='APPROVED' and p_status in ('COMPLETED','REJECTED'))) then
    raise exception 'Invalid deletion request status transition' using errcode='22023';
  end if;
  if p_status='COMPLETED' and char_length(btrim(p_resolution_note))<12 then
    raise exception 'Describe how the deletion was carried out and verified before marking it complete' using errcode='22023';
  end if;
  update private.data_deletion_requests
  set status=p_status,updated_at=now(),reviewed_by=(select auth.uid()),reviewed_at=now(),resolution_note=p_resolution_note
  where id=p_request_id and organization_id=v_org;
  perform private.admin_record_audit('data_deletion.'||lower(p_status),'data_deletion_request',p_request_id,
    jsonb_build_object('status',p_status,'requester_id',v_requester));
end;
$$;

create or replace function private.capture_feedback_version()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.title is distinct from new.title or old.description is distinct from new.description
    or old.form_schema is distinct from new.form_schema or old.due_at is distinct from new.due_at then
    insert into private.feedback_versions(feedback_id,version,title,description,form_schema,due_at,changed_by,organization_id)
    values(old.id,old.version,old.title,old.description,old.form_schema,old.due_at,(select auth.uid()),old.organization_id);
    new.version:=old.version+1;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_feedback_deadline()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_due timestamptz;v_open boolean;v_status public.course_status;
begin
  select f.due_at,f.is_open,c.status into v_due,v_open,v_status
  from public.feedback f join public.courses c on c.id=f.course_id and c.organization_id=f.organization_id
  where f.id=new.feedback_id and f.organization_id=new.organization_id;
  if not found or v_open is distinct from true or v_status is distinct from 'PUBLISHED'::public.course_status then
    raise exception 'Feedback form is closed or unavailable' using errcode='P0002';
  end if;
  if v_due is not null and now()>v_due then raise exception 'Feedback deadline has passed' using errcode='P0002'; end if;
  return new;
end;
$$;

create or replace function private.get_head_student_roster()
returns table(student_id uuid,student_number text,full_name text,email text,mobile text,department_id uuid,department_name text,
  course_id uuid,course_code text,course_title text,section text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() or coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
    raise exception 'College Head administrator MFA is required' using errcode='42501';
  end if;
  return query
  select d.student_id,d.student_number,u.full_name,u.email,contact.mobile,d.department_id,dept.name,
    c.id,c.course_code,c.title,e.section
  from public.student_directory d
  join public.users u on u.id=d.student_id and u.organization_id=d.organization_id
  left join private.student_contact_profiles contact on contact.student_id=d.student_id and contact.organization_id=d.organization_id
  left join public.departments dept on dept.id=d.department_id and dept.organization_id=d.organization_id
  left join public.course_enrollments e on e.student_id=d.student_id and e.organization_id=d.organization_id
  left join public.courses c on c.id=e.course_id and c.organization_id=e.organization_id
  where d.organization_id=private.current_organization_id()
  order by u.full_name,c.title;
end;
$$;
revoke all on function private.get_head_student_roster() from public,anon,authenticated;
grant execute on function private.get_head_student_roster() to authenticated;
create or replace function public.get_head_student_roster()
returns table(student_id uuid,student_number text,full_name text,email text,mobile text,department_id uuid,department_name text,
  course_id uuid,course_code text,course_title text,section text)
language sql security invoker set search_path = ''
as $$ select * from private.get_head_student_roster() $$;
revoke all on function public.get_head_student_roster() from public,anon;
grant execute on function public.get_head_student_roster() to authenticated;

create or replace function private.get_instructor_students(p_course_id uuid)
returns table(student_id uuid,student_number text,full_name text,course_id uuid,course_code text,course_title text,section text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_course_owner(p_course_id) then
    raise exception 'Assigned instructor access is required' using errcode='42501';
  end if;
  return query
  select d.student_id,d.student_number,u.full_name,c.id,c.course_code,c.title,e.section
  from public.course_enrollments e
  join public.courses c on c.id=e.course_id and c.organization_id=e.organization_id
  join public.student_directory d on d.student_id=e.student_id and d.organization_id=e.organization_id
  join public.users u on u.id=e.student_id and u.organization_id=e.organization_id
  where e.course_id=p_course_id and e.organization_id=private.current_organization_id()
    and u.role='STUDENT'::public.app_role and u.is_active=true
  order by u.full_name;
end;
$$;
revoke all on function private.get_instructor_students(uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_students(uuid) to authenticated;
create or replace function public.get_instructor_students(p_course_id uuid)
returns table(student_id uuid,student_number text,full_name text,course_id uuid,course_code text,course_title text,section text)
language sql security invoker set search_path = ''
as $$ select * from private.get_instructor_students(p_course_id) $$;
revoke all on function public.get_instructor_students(uuid) from public,anon;
grant execute on function public.get_instructor_students(uuid) to authenticated;

create or replace function private.verify_student_card(p_token_hash text)
returns table(student_name text,student_number text,college_name text,enrollment_sections text[],valid_until timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
  return query
  select u.full_name,d.student_number,o.name,
    coalesce(array_agg(distinct nullif(e.section,'') order by nullif(e.section,''))
      filter(where nullif(e.section,'') is not null),'{}'::text[]),
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
revoke all on function private.verify_student_card(text) from public,anon,authenticated;
grant execute on function private.verify_student_card(text) to anon,authenticated;
create or replace function public.verify_student_card(p_token_hash text)
returns table(student_name text,student_number text,college_name text,enrollment_sections text[],valid_until timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.verify_student_card(p_token_hash) $$;
revoke all on function public.verify_student_card(text) from public;
grant execute on function public.verify_student_card(text) to anon,authenticated;

create or replace function private.generate_monthly_academic_reports_for_org(p_org uuid,p_report_month date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_month date:=date_trunc('month',p_report_month)::date;v_end date:=(date_trunc('month',p_report_month)+interval '1 month')::date;v_rows integer:=0;
begin
  if p_org is null or p_report_month is null then raise exception 'Organization and report month are required'; end if;
  delete from public.monthly_academic_reports where organization_id=p_org and report_month=v_month;
  with source_ratings as (
    select c.id course_id,c.title course_title,c.department_id,d.name department_name,f.id feedback_id,
      q.value->>'id' question_id,(s.answers->>(q.value->>'id'))::numeric rating
    from public.anonymous_submissions s
    join public.feedback f on f.id=s.feedback_id and f.organization_id=s.organization_id
    join public.courses c on c.id=f.course_id and c.organization_id=s.organization_id
    left join public.departments d on d.id=c.department_id and d.organization_id=c.organization_id
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    where s.organization_id=p_org and s.received_on>=v_month and s.received_on<v_end
      and q.value->>'type'='rating' and q.value->>'id' is not null
      and coalesce(s.answers->>(q.value->>'id'),'') ~ '^[1-5]$'
  ), eligible_question_groups as (
    select course_id,course_title,department_id,department_name,feedback_id,question_id,
      count(*)::bigint responses,avg(rating)::numeric group_average
    from source_ratings group by course_id,course_title,department_id,department_name,feedback_id,question_id
    having count(*)>=5
  ), course_metrics as (
    select 'COURSE'::text scope_type,course_id scope_id,max(course_title) scope_label,
      sum(responses)::bigint response_count,(sum(group_average*responses)/nullif(sum(responses),0))::numeric(4,2) average_rating
    from eligible_question_groups group by course_id
  ), department_question_groups as (
    select department_id,department_name,feedback_id,question_id,count(*)::bigint responses,avg(rating)::numeric group_average
    from source_ratings where department_id is not null
    group by department_id,department_name,feedback_id,question_id having count(*)>=5
  ), department_metrics as (
    select 'DEPARTMENT'::text scope_type,department_id scope_id,max(department_name) scope_label,
      sum(responses)::bigint response_count,(sum(group_average*responses)/nullif(sum(responses),0))::numeric(4,2) average_rating
    from department_question_groups group by department_id
  ), college_question_groups as (
    select feedback_id,question_id,count(*)::bigint responses,avg(rating)::numeric group_average
    from source_ratings group by feedback_id,question_id having count(*)>=5
  ), college_metrics as (
    select 'COLLEGE'::text scope_type,'00000000-0000-0000-0000-000000000000'::uuid scope_id,
      'College-wide'::text scope_label,sum(responses)::bigint response_count,
      (sum(group_average*responses)/nullif(sum(responses),0))::numeric(4,2) average_rating
    from college_question_groups having count(*)>0
  ), all_metrics as (
    select * from course_metrics union all select * from department_metrics union all select * from college_metrics
  )
  insert into public.monthly_academic_reports(
    organization_id,report_month,scope_type,scope_id,scope_label,response_count,average_rating,
    previous_average,rating_change,recommendation,generated_at
  )
  select p_org,v_month,current.scope_type,current.scope_id,current.scope_label,current.response_count,current.average_rating,
    previous.average_rating,
    case when previous.average_rating is null then null else (current.average_rating-previous.average_rating)::numeric(4,2) end,
    case when current.average_rating<3 then 'Plan a supportive review of course delivery and identify teaching resources or mentoring that may help.'
      when current.average_rating<3.5 then 'Review course structure and assessment feedback with the department and agree practical improvements.'
      when current.average_rating>=4.25 then 'Capture effective teaching practices and share them as optional examples across the department.'
      else 'Continue monitoring this course and compare the next reporting period before changing the teaching plan.' end,
    now()
  from all_metrics current
  left join public.monthly_academic_reports previous on previous.organization_id=p_org
    and previous.report_month=(v_month-interval '1 month')::date
    and previous.scope_type=current.scope_type and previous.scope_id=current.scope_id
  on conflict(organization_id,report_month,scope_type,scope_id) do update set
    scope_label=excluded.scope_label,response_count=excluded.response_count,average_rating=excluded.average_rating,
    previous_average=excluded.previous_average,rating_change=excluded.rating_change,
    recommendation=excluded.recommendation,generated_at=excluded.generated_at;
  get diagnostics v_rows=row_count;return v_rows;
end;
$$;
revoke all on function private.generate_monthly_academic_reports_for_org(uuid,date) from public,anon,authenticated;

create or replace function private.notify_monthly_low_rated_teachers_for_org(p_org uuid,p_report_month date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_month date:=date_trunc('month',p_report_month)::date;v_end date:=(date_trunc('month',p_report_month)+interval '1 month')::date;
  v_threshold numeric;v_minimum integer;v_created integer:=0;
begin
  select rating_threshold,minimum_responses into v_threshold,v_minimum
  from public.monthly_report_settings where id=1 and organization_id=p_org;
  v_threshold:=coalesce(v_threshold,3);v_minimum:=coalesce(v_minimum,10);
  with source_ratings as (
    select c.id course_id,f.id feedback_id,q.value->>'id' question_id,(s.answers->>(q.value->>'id'))::numeric rating
    from public.anonymous_submissions s
    join public.feedback f on f.id=s.feedback_id and f.organization_id=s.organization_id
    join public.courses c on c.id=f.course_id and c.organization_id=s.organization_id
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    where s.organization_id=p_org and s.received_on>=v_month and s.received_on<v_end
      and q.value->>'type'='rating' and q.value->>'id' is not null
      and coalesce(s.answers->>(q.value->>'id'),'') ~ '^[1-5]$'
  ), eligible_question_groups as (
    select course_id,feedback_id,question_id,count(*)::bigint responses,avg(rating)::numeric group_average
    from source_ratings group by course_id,feedback_id,question_id having count(*)>=5
  ), eligible_forms as (
    select course_id,feedback_id,avg(group_average)::numeric form_average,max(responses)::bigint responses
    from eligible_question_groups group by course_id,feedback_id
  ), course_teachers as (
    select c.id course_id,c.instructor_id from public.courses c where c.organization_id=p_org
    union select a.course_id,a.instructor_id from public.instructor_course_assignments a where a.organization_id=p_org
  ), teacher_metrics as (
    select assigned.instructor_id recipient_id,sum(form.responses)::bigint response_count,
      (sum(form.form_average*form.responses)/nullif(sum(form.responses),0))::numeric average_rating
    from eligible_forms form join course_teachers assigned on assigned.course_id=form.course_id
    join public.users u on u.id=assigned.instructor_id and u.organization_id=p_org
      and u.role='INSTRUCTOR'::public.app_role and u.is_active=true
    group by assigned.instructor_id
  )
  insert into public.teacher_notifications(recipient_id,created_by,category,period_start,title,body,organization_id)
  select metric.recipient_id,null,'PERFORMANCE_REVIEW',v_month,'Private teaching feedback review',
    'Please meet the College Head for a confidential discussion about recent course feedback and possible teaching support. This is a supportive review request, not a disciplinary finding. The office will coordinate a suitable time with you.',
    p_org
  from teacher_metrics metric where metric.response_count>=v_minimum and metric.average_rating<v_threshold
  on conflict(recipient_id,category,period_start) do nothing;
  get diagnostics v_created=row_count;return v_created;
end;
$$;
revoke all on function private.notify_monthly_low_rated_teachers_for_org(uuid,date) from public,anon,authenticated;

create or replace function private.generate_monthly_academic_reports(p_report_month date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare o record;v_total integer:=0;
begin
  for o in select id from public.organizations where status='ACTIVE' loop
    v_total:=v_total+private.generate_monthly_academic_reports_for_org(o.id,p_report_month);
  end loop;
  return v_total;
end;
$$;
revoke all on function private.generate_monthly_academic_reports(date) from public,anon,authenticated;

create or replace function private.notify_monthly_low_rated_teachers(p_report_month date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare o record;v_total integer:=0;
begin
  for o in select id from public.organizations where status='ACTIVE' loop
    v_total:=v_total+private.notify_monthly_low_rated_teachers_for_org(o.id,p_report_month);
  end loop;
  return v_total;
end;
$$;
revoke all on function private.notify_monthly_low_rated_teachers(date) from public,anon,authenticated;

create or replace function private.run_monthly_academic_close(p_report_month date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare o record;v_total integer:=0;
begin
  for o in select id from public.organizations where status='ACTIVE' loop
    v_total:=v_total+private.generate_monthly_academic_reports_for_org(o.id,p_report_month);
    v_total:=v_total+private.notify_monthly_low_rated_teachers_for_org(o.id,p_report_month);
  end loop;
  return v_total;
end;
$$;
revoke all on function private.run_monthly_academic_close(date) from public,anon,authenticated;

create or replace function private.claim_admin_signup(p_code text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.claim_setup_workspace(p_code);
end;
$$;
