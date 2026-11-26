-- CoursePulse authenticated feedback portal: questions, anonymous analytics
-- projection, course-level duplicate protection and role-safe staff provisioning.
-- The existing multi-tenant users/courses/feedback tables remain canonical.

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  feedback_id uuid references public.feedback(id) on delete cascade,
  answer_key text not null default gen_random_uuid()::text,
  label text not null check (char_length(btrim(label)) between 2 and 180),
  type text not null check (type in ('rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no')),
  order_index integer not null default 0,
  is_active boolean not null default true,
  is_required boolean not null default true,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  category text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_feedback_requires_course check (feedback_id is null or course_id is not null)
);
create unique index if not exists questions_form_answer_key_uq on public.questions (organization_id, feedback_id, answer_key) where feedback_id is not null;
create unique index if not exists questions_course_answer_key_uq on public.questions (organization_id, course_id, answer_key) where feedback_id is null and course_id is not null;
create unique index if not exists questions_global_answer_key_uq on public.questions (organization_id, answer_key) where feedback_id is null and course_id is null;
create index if not exists questions_scope_order_idx on public.questions (organization_id, course_id, feedback_id, is_active, order_index);
alter table public.questions enable row level security;
alter table public.questions force row level security;
revoke all on table public.questions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.questions to authenticated;

drop policy if exists questions_select_scoped on public.questions;
create policy questions_select_scoped on public.questions for select to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id)))
    or (
      private.current_app_role() = 'STUDENT'::public.app_role
      and is_active = true
      and exists (
        select 1
        from public.course_enrollments e
        join public.courses c on c.id = e.course_id and c.organization_id = e.organization_id
        where e.student_id = (select auth.uid())
          and e.organization_id = questions.organization_id
          and c.status = 'PUBLISHED'::public.course_status
          and (
            (questions.feedback_id is null and questions.course_id is null)
            or (questions.feedback_id is null and questions.course_id = c.id)
            or (
              questions.feedback_id is not null
              and exists (
                select 1 from public.feedback f
                where f.id = questions.feedback_id
                  and f.course_id = c.id
                  and f.organization_id = c.organization_id
              )
            )
          )
      )
    )
  )
);
drop policy if exists questions_insert_instructor on public.questions;
create policy questions_insert_instructor on public.questions for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and created_by = (select auth.uid())
  and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
  and (
    feedback_id is null or exists (
      select 1 from public.feedback f
      where f.id = questions.feedback_id and f.course_id = questions.course_id
        and f.organization_id = questions.organization_id
        and (private.is_admin() or private.is_course_owner(f.course_id))
    )
  )
);
drop policy if exists questions_update_instructor on public.questions;
create policy questions_update_instructor on public.questions for update to authenticated
using (organization_id = private.current_organization_id() and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
with check (organization_id = private.current_organization_id() and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))));
drop policy if exists questions_delete_instructor on public.questions;
create policy questions_delete_instructor on public.questions for delete to authenticated
using (organization_id = private.current_organization_id() and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))));

insert into public.questions (
  organization_id, course_id, feedback_id, answer_key, label, type,
  order_index, is_active, is_required, options, category, created_by
)
select
  f.organization_id, f.course_id, f.id, left(q.value->>'id',120),
  left(btrim(q.value->>'label'),180),
  case when q.value->>'type' in ('rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no') then q.value->>'type' else 'text' end,
  (q.ordinality - 1)::integer, true, coalesce((q.value->>'required')::boolean,true),
  case when jsonb_typeof(q.value->'options')='array' then q.value->'options' else '[]'::jsonb end,
  left(q.value->>'category',80), f.created_by
from public.feedback f
cross join lateral jsonb_array_elements(case when jsonb_typeof(f.form_schema)='array' then f.form_schema else '[]'::jsonb end)
with ordinality as q(value, ordinality)
where coalesce(q.value->>'id','') <> '' and coalesce(q.value->>'label','') <> ''
on conflict do nothing;

create or replace view public.profiles with (security_invoker = true) as
select id, full_name, username, program as programme, lower(role::text) as role, organization_id
from public.users;
revoke all on public.profiles from public, anon;
grant select on public.profiles to authenticated;

create table if not exists private.submission_tracker (
  student_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (student_id, course_id)
);
create index if not exists submission_tracker_org_course_idx on private.submission_tracker (organization_id, course_id, submitted_at);
alter table private.submission_tracker enable row level security;
alter table private.submission_tracker force row level security;
revoke all on table private.submission_tracker from public, anon, authenticated, service_role;
drop policy if exists submission_tracker_deny_api on private.submission_tracker;
create policy submission_tracker_deny_api on private.submission_tracker for all to anon, authenticated using (false) with check (false);

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null,
  comment text not null default '',
  ratings_json jsonb not null default '{}'::jsonb,
  constraint feedback_submissions_ratings_object check (jsonb_typeof(ratings_json) = 'object')
);
create index if not exists feedback_submissions_filter_idx on public.feedback_submissions (organization_id, course_id, feedback_id, created_at);
alter table public.feedback_submissions enable row level security;
alter table public.feedback_submissions force row level security;
revoke all on table public.feedback_submissions from public, anon, authenticated, service_role;
-- Direct table SELECT is deliberately not granted; filtered access uses a privacy RPC.

create or replace function private.feedback_submission_group_reportable(p_feedback_id uuid, p_organization_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' set row_security = off
as $function$
declare v_course_id uuid; v_count bigint;
begin
  if (select auth.uid()) is null or private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role)
     or p_organization_id <> private.current_organization_id() then return false; end if;
  select f.course_id into v_course_id from public.feedback f
  where f.id = p_feedback_id and f.organization_id = p_organization_id;
  if v_course_id is null or not (private.is_admin() or private.is_course_owner(v_course_id)) then return false; end if;
  select count(*) into v_count from public.feedback_submissions s
  where s.feedback_id = p_feedback_id and s.organization_id = p_organization_id;
  return v_count >= 5;
end;
$function$;
revoke all on function private.feedback_submission_group_reportable(uuid,uuid) from public, anon;
grant execute on function private.feedback_submission_group_reportable(uuid,uuid) to authenticated;

drop policy if exists feedback_submissions_instructor_read on public.feedback_submissions;
create policy feedback_submissions_instructor_read on public.feedback_submissions for select to authenticated
using (
  organization_id = private.current_organization_id()
  and private.current_app_role() in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role)
  and (private.is_admin() or private.is_course_owner(course_id))
  and private.feedback_submission_group_reportable(feedback_id, organization_id)
);

create or replace function private.track_anonymous_course_submission()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_student_id uuid := (select auth.uid());
  v_course_id uuid;
  v_org uuid;
  v_inserted integer;
begin
  if v_student_id is null or private.current_app_role() <> 'STUDENT'::public.app_role then
    raise exception 'Only authenticated students can submit feedback' using errcode = '42501';
  end if;
  select f.course_id, f.organization_id into v_course_id, v_org
  from public.feedback f
  join public.courses c on c.id=f.course_id and c.organization_id=f.organization_id
  join public.course_enrollments e on e.course_id=c.id and e.organization_id=c.organization_id and e.student_id=v_student_id
  where f.id=new.feedback_id and f.organization_id=private.current_organization_id()
    and f.is_open=true and c.status='PUBLISHED'::public.course_status;
  if v_course_id is null then raise exception 'Course feedback is unavailable to this student' using errcode='42501'; end if;
  insert into private.submission_tracker(student_id,course_id,organization_id)
  values(v_student_id,v_course_id,v_org) on conflict(student_id,course_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then raise exception 'You have already submitted feedback for this course' using errcode='23505'; end if;
  return new;
end;
$function$;
revoke all on function private.track_anonymous_course_submission() from public, anon, authenticated, service_role;
drop trigger if exists anonymous_submissions_track_course_once on public.anonymous_submissions;
create trigger anonymous_submissions_track_course_once before insert on public.anonymous_submissions
for each row execute function private.track_anonymous_course_submission();

create or replace function private.get_student_feedback_status()
returns table(feedback_id uuid, submitted boolean)
language sql stable security definer set search_path = ''
as $function$
  select f.id, coalesce(st.course_id is not null, e.consumed, false)
  from public.feedback f
  join public.courses c on c.id=f.course_id and c.organization_id=f.organization_id
  join public.course_enrollments ce on ce.course_id=c.id and ce.organization_id=c.organization_id and ce.student_id=(select auth.uid())
  left join private.submission_tracker st on st.student_id=(select auth.uid()) and st.course_id=c.id and st.organization_id=f.organization_id
  left join private.feedback_eligibility e on e.feedback_id=f.id and e.student_id=(select auth.uid()) and e.organization_id=f.organization_id
  where f.organization_id=private.current_organization_id()
    and c.status='PUBLISHED'::public.course_status
    and private.current_app_role()='STUDENT'::public.app_role;
$function$;
revoke all on function private.get_student_feedback_status() from public, anon, authenticated, service_role;
grant execute on function private.get_student_feedback_status() to authenticated;

create or replace function private.sync_feedback_form_questions(p_feedback_id uuid, p_questions jsonb)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_course_id uuid; v_organization_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then raise exception 'Instructor access required' using errcode='42501'; end if;
  if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<1 or jsonb_array_length(p_questions)>30 then raise exception 'A form must contain between 1 and 30 questions' using errcode='22023'; end if;
  select f.course_id,f.organization_id into v_course_id,v_organization_id
  from public.feedback f where f.id=p_feedback_id and f.organization_id=private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(f.course_id)) for update;
  if v_course_id is null then raise exception 'Feedback form not found or not editable' using errcode='42501'; end if;
  delete from public.questions q where q.feedback_id=p_feedback_id and q.organization_id=v_organization_id;
  insert into public.questions(organization_id,course_id,feedback_id,answer_key,label,type,order_index,is_active,is_required,options,category,created_by)
  select v_organization_id,v_course_id,p_feedback_id,left(value->>'id',120),left(btrim(value->>'label'),180),value->>'type',
    (ordinality-1)::integer,true,coalesce((value->>'required')::boolean,true),
    case when jsonb_typeof(value->'options')='array' then value->'options' else '[]'::jsonb end,left(value->>'category',80),(select auth.uid())
  from jsonb_array_elements(p_questions) with ordinality as q(value,ordinality)
  where coalesce(value->>'id','')<>'' and char_length(btrim(coalesce(value->>'label',''))) between 2 and 180
    and value->>'type' in ('rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no');
  if not found then raise exception 'No valid questions were provided' using errcode='22023'; end if;
end;
$function$;
revoke all on function private.sync_feedback_form_questions(uuid,jsonb) from public, anon;
grant execute on function private.sync_feedback_form_questions(uuid,jsonb) to authenticated;

create or replace function private.sync_question_catalog_to_feedback(p_course_id uuid default null)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_org uuid:=private.current_organization_id(); v_form record; v_schema jsonb; v_count integer:=0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then raise exception 'Instructor access required' using errcode='42501'; end if;
  if p_course_id is not null and not (private.is_admin() or private.is_course_owner(p_course_id)) then raise exception 'Course is not assigned to this instructor' using errcode='42501'; end if;
  for v_form in select f.id,f.course_id from public.feedback f
    where f.organization_id=v_org and (p_course_id is null or f.course_id=p_course_id)
      and (private.is_admin() or private.is_course_owner(f.course_id))
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',catalog.answer_key,'label',catalog.label,'type',catalog.type,'required',catalog.is_required,
      'options',catalog.options,'category',catalog.category
    ) order by catalog.order_index,catalog.answer_key),'[]'::jsonb)
    into v_schema
    from (
      select distinct on(q.answer_key) q.* from public.questions q
      where q.organization_id=v_org and q.is_active=true
        and (q.feedback_id=v_form.id or (q.feedback_id is null and q.course_id=v_form.course_id) or (q.feedback_id is null and q.course_id is null))
      order by q.answer_key,case when q.feedback_id=v_form.id then 1 when q.course_id=v_form.course_id then 2 else 3 end,q.order_index
    ) catalog;
    if jsonb_array_length(v_schema)>0 then
      update public.feedback set form_schema=v_schema,updated_at=now() where id=v_form.id and organization_id=v_org;
    else
      update public.feedback set form_schema='[]'::jsonb,is_open=false,updated_at=now() where id=v_form.id and organization_id=v_org;
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$function$;
revoke all on function private.sync_question_catalog_to_feedback(uuid) from public, anon;
grant execute on function private.sync_question_catalog_to_feedback(uuid) to authenticated;

create or replace function private.capture_anonymous_feedback_projection()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_course_id uuid; v_org uuid; v_comment text; v_ratings jsonb;
begin
  select f.course_id,f.organization_id into v_course_id,v_org from public.feedback f where f.id=new.feedback_id;
  if v_course_id is null or v_org is null then raise exception 'Feedback form not found for anonymous response' using errcode='23503'; end if;
  with scoped_questions as (
    select distinct on(q.answer_key) q.answer_key,q.label,q.type,q.order_index from public.questions q
    where q.organization_id=v_org and q.is_active=true
      and (q.feedback_id=new.feedback_id or (q.feedback_id is null and q.course_id=v_course_id) or (q.feedback_id is null and q.course_id is null))
    order by q.answer_key,case when q.feedback_id=new.feedback_id then 1 when q.course_id=v_course_id then 2 else 3 end,q.order_index
  )
  select
    (select string_agg(sq.label||': '||(new.answers->>sq.answer_key),E'\n' order by sq.order_index)
     from scoped_questions sq where sq.type in ('text','textarea') and jsonb_typeof(new.answers->sq.answer_key)='string' and char_length(btrim(new.answers->>sq.answer_key))>0),
    (select coalesce(jsonb_object_agg(sq.answer_key,new.answers->sq.answer_key),'{}'::jsonb)
     from scoped_questions sq where sq.type='rating' and jsonb_typeof(new.answers->sq.answer_key)='number' and (new.answers->>sq.answer_key)~'^[1-5]$')
  into v_comment,v_ratings;
  v_comment:=regexp_replace(coalesce(v_comment,''),'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}','[redacted email]','gi');
  v_comment:=regexp_replace(v_comment,'(\+?[0-9][0-9 ()-]{6,}[0-9])','[redacted phone]','g');
  v_comment:=regexp_replace(v_comment,'[0-9]{10,12}','[redacted number]','g');
  v_comment:=regexp_replace(v_comment,'(roll[[:space:]_-]*(number|no|#)?[[:space:]#:-]*[[:alnum:]/-]{3,})','[redacted student identifier]','gi');
  v_comment:=regexp_replace(v_comment,'(student[[:space:]_-]*(id|number|no)[[:space:]#:-]*[[:alnum:]/-]{3,})','[redacted student identifier]','gi');
  v_comment:=regexp_replace(v_comment,'https?://[^[:space:]]+','[redacted link]','gi');
  insert into public.feedback_submissions(feedback_id,course_id,organization_id,created_at,comment,ratings_json)
  values(new.feedback_id,v_course_id,v_org,(new.received_on::timestamp at time zone 'UTC'),v_comment,coalesce(v_ratings,'{}'::jsonb));
  return new;
end;
$function$;
revoke all on function private.capture_anonymous_feedback_projection() from public, anon, authenticated, service_role;
drop trigger if exists anonymous_submissions_capture_projection on public.anonymous_submissions;
create trigger anonymous_submissions_capture_projection after insert on public.anonymous_submissions
for each row execute function private.capture_anonymous_feedback_projection();

create or replace function public.get_course_instructor_names(p_course_ids uuid[])
returns table(course_id uuid,instructor_name text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then raise exception 'Instructor access required' using errcode='42501'; end if;
  if p_course_ids is null or cardinality(p_course_ids)<1 or cardinality(p_course_ids)>10 then raise exception 'Select between 1 and 10 courses' using errcode='22023'; end if;
  return query
  select c.id,coalesce(string_agg(distinct instructor.full_name,', ' order by instructor.full_name),'Unassigned')::text
  from public.courses c
  left join lateral (
    select u.full_name from public.users u where u.id=c.instructor_id
    union
    select assigned.full_name from public.instructor_course_assignments a
    join public.users assigned on assigned.id=a.instructor_id
    where a.course_id=c.id and a.organization_id=c.organization_id
  ) instructor on true
  where c.id=any(p_course_ids) and c.organization_id=private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(c.id))
  group by c.id;
end;
$function$;
revoke all on function public.get_course_instructor_names(uuid[]) from public, anon;
grant execute on function public.get_course_instructor_names(uuid[]) to authenticated;

-- Staff and roster-created student accounts require a real college invitation.
-- Public self-registration remains restricted to the username-only Student path.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_full_name text:=left(btrim(coalesce(new.raw_user_meta_data->>'full_name','')),120);
  v_program text:=left(btrim(coalesce(new.raw_user_meta_data->>'program','')),80);
  v_username text:=lower(btrim(coalesce(new.raw_user_meta_data->>'username','')));
  v_is_internal_username boolean:=lower(coalesce(new.email,'')) like '%@students.coursepulse.invalid';
  v_invitation public.organization_invitations%rowtype;
  v_course_id uuid;
begin
  if v_is_internal_username then
    if char_length(v_full_name)<2 then raise exception 'A student name is required' using errcode='23514'; end if;
    if char_length(v_program)<2 then raise exception 'A student programme is required' using errcode='23514'; end if;
    if v_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'A valid student username is required' using errcode='23514'; end if;
    insert into public.users(id,email,username,full_name,role,organization_id,department_id,program)
    values(new.id,null,v_username,v_full_name,'STUDENT'::public.app_role,null,null,v_program) on conflict(id) do nothing;
  else
    select invitation.* into v_invitation
    from public.organization_invitations invitation
    join public.organizations organization on organization.id=invitation.organization_id and organization.status='ACTIVE'::public.organization_status
    where lower(invitation.email)=lower(coalesce(new.email,''))
      and invitation.status in ('PENDING','INVITED') and invitation.expires_at>now()
    order by invitation.created_at desc limit 1 for update of invitation;
    if not found then raise exception 'An active college invitation is required for this account.' using errcode='42501'; end if;
    if char_length(btrim(v_invitation.full_name))<2 or cardinality(v_invitation.course_ids)<1 then raise exception 'The invitation is incomplete.' using errcode='23514'; end if;
    insert into public.users(id,email,username,full_name,role,organization_id,department_id,program,is_active)
    values(new.id,lower(new.email),null,left(btrim(v_invitation.full_name),120),v_invitation.invited_role::public.app_role,
      v_invitation.organization_id,v_invitation.department_id,null,true) on conflict(id) do nothing;
    if v_invitation.invited_role='INSTRUCTOR'::public.app_role then
      foreach v_course_id in array v_invitation.course_ids loop
        if not exists(select 1 from public.courses course where course.id=v_course_id and course.organization_id=v_invitation.organization_id) then
          raise exception 'An invited course is outside the college.' using errcode='42501';
        end if;
        insert into public.instructor_course_assignments(course_id,instructor_id,assigned_by,organization_id)
        values(v_course_id,new.id,v_invitation.invited_by,v_invitation.organization_id) on conflict(course_id,instructor_id) do nothing;
      end loop;
    elsif v_invitation.invited_role='STUDENT'::public.app_role then
      if coalesce(btrim(v_invitation.student_number),'')='' then raise exception 'Student invitations must include a student number.' using errcode='23514'; end if;
      insert into public.student_directory(organization_id,student_id,student_number,department_id)
      values(v_invitation.organization_id,new.id,btrim(v_invitation.student_number),v_invitation.department_id)
      on conflict(organization_id,student_id) do update set student_number=excluded.student_number,department_id=excluded.department_id,updated_at=now();
      foreach v_course_id in array v_invitation.course_ids loop
        if not exists(select 1 from public.courses course where course.id=v_course_id and course.organization_id=v_invitation.organization_id) then
          raise exception 'An invited course is outside the college.' using errcode='42501';
        end if;
        insert into public.course_enrollments(course_id,student_id,enrolled_by,organization_id,section)
        values(v_course_id,new.id,v_invitation.invited_by,v_invitation.organization_id,v_invitation.section)
        on conflict(course_id,student_id) do nothing;
      end loop;
    else
      raise exception 'Only Student and Instructor invitations are supported.' using errcode='42501';
    end if;
    update public.organization_invitations set status='ACCEPTED',auth_user_id=new.id,updated_at=now() where id=v_invitation.id;
  end if;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)-'admin_signup_code'-'requested_role'-'organization_id'-'role'-'invitation_id' where id=new.id;
  return new;
end;
$function$;
