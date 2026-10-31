-- Academic structure, enrollment, instructor assignment and account lifecycle.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 120),
  code text not null unique check (char_length(btrim(code)) between 2 and 20),
  created_at timestamptz not null default now()
);
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 100),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
alter table public.users add column is_active boolean not null default true;
alter table public.users add column suspended_at timestamptz;
alter table public.users add column department_id uuid references public.departments(id) on delete set null;
alter table public.courses add column department_id uuid references public.departments(id) on delete set null;
alter table public.courses add column semester_id uuid references public.semesters(id) on delete set null;
create index courses_department_idx on public.courses(department_id);
create index courses_semester_idx on public.courses(semester_id);
create index users_department_idx on public.users(department_id);

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  enrolled_by uuid not null references public.users(id) on delete restrict,
  enrolled_at timestamptz not null default now(),
  unique(course_id, student_id)
);
create index course_enrollments_student_idx on public.course_enrollments(student_id);
create index course_enrollments_course_idx on public.course_enrollments(course_id);

create table public.instructor_course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references public.users(id) on delete cascade,
  assigned_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(course_id, instructor_id)
);
create index instructor_assignments_instructor_idx on public.instructor_course_assignments(instructor_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id uuid,
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 4096),
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id);

alter table public.departments enable row level security;
alter table public.semesters enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.instructor_course_assignments enable row level security;
alter table public.audit_logs enable row level security;

grant select, insert, update, delete on public.departments, public.semesters, public.course_enrollments, public.instructor_course_assignments to authenticated;
grant select on public.audit_logs to authenticated;

create policy departments_read_authenticated on public.departments for select to authenticated using (true);
create policy departments_admin_manage on public.departments for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy semesters_read_authenticated on public.semesters for select to authenticated using (true);
create policy semesters_admin_manage on public.semesters for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy course_enrollments_scoped_read on public.course_enrollments for select to authenticated
using (student_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_owner(course_id)));
create policy course_enrollments_admin_manage on public.course_enrollments for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy instructor_assignments_scoped_read on public.instructor_course_assignments for select to authenticated
using (instructor_id = (select auth.uid()) or (select private.is_admin()));
create policy instructor_assignments_admin_manage on public.instructor_course_assignments for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy audit_logs_admin_read on public.audit_logs for select to authenticated
using ((select private.is_admin()));

-- Existing table-level grants were deliberately narrow; explicitly grant only
-- the new profile/course columns required by authenticated app reads.
grant select (is_active, suspended_at, department_id) on public.users to authenticated;
grant select (department_id, semester_id) on public.courses to authenticated;
grant update (department_id, semester_id) on public.courses to authenticated;

create or replace function private.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select u.role from public.users u where u.id=(select auth.uid()) and u.is_active=true limit 1 $$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $ select coalesce(private.current_app_role()='ADMIN'::public.app_role and (auth.jwt()->>'aal')='aal2',false) $;

create or replace function private.is_course_owner(p_course_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.is_instructor() and exists (
    select 1 from public.courses c
    where c.id=p_course_id
      and (
        c.instructor_id=(select auth.uid())
        or exists (select 1 from public.instructor_course_assignments a where a.course_id=c.id and a.instructor_id=(select auth.uid()))
      )
  ),false)
$$;

drop policy if exists courses_select_scoped on public.courses;
create policy courses_select_scoped on public.courses for select to authenticated
using ((select private.is_admin()) or (select private.is_course_owner(id)) or
  (status='PUBLISHED'::public.course_status and (select private.current_app_role())='STUDENT'::public.app_role
   and exists(select 1 from public.course_enrollments e where e.course_id=courses.id and e.student_id=(select auth.uid()))));

drop policy if exists feedback_select_scoped on public.feedback;
create policy feedback_select_scoped on public.feedback for select to authenticated
using ((select private.is_admin()) or (select private.is_course_owner(course_id)) or
  (is_open=true and (select private.current_app_role())='STUDENT'::public.app_role
   and exists(select 1 from public.course_enrollments e where e.course_id=feedback.course_id and e.student_id=(select auth.uid()))
   and exists(select 1 from public.courses c where c.id=feedback.course_id and c.status='PUBLISHED'::public.course_status)));

do $
declare v_definition text;
begin
  select pg_get_functiondef('private.get_instructor_aggregates(uuid)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, 'c.instructor_id = (select auth.uid())', 'private.is_course_owner(c.id)');
  execute v_definition;
end;
$;

-- The RPC is the only path from identity-based eligibility to identity-free answers.
create or replace function private.submit_anonymous_feedback(p_feedback_id uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id uuid := (select auth.uid());
  v_claimed boolean;
  v_form_schema jsonb;
  v_question jsonb;
  v_value jsonb;
begin
  if v_student_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if private.current_app_role() <> 'STUDENT'::public.app_role then raise exception 'Only students can submit feedback' using errcode='42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers)>32768 then raise exception 'Invalid answer payload' using errcode='22023'; end if;
  select f.form_schema into v_form_schema
  from public.feedback f join public.courses c on c.id=f.course_id
  join public.course_enrollments e on e.course_id=c.id and e.student_id=v_student_id
  where f.id=p_feedback_id and f.is_open=true and c.status='PUBLISHED'::public.course_status;
  if v_form_schema is null then raise exception 'Feedback form is closed or unavailable to this student' using errcode='P0002'; end if;
  if jsonb_typeof(v_form_schema)<>'array' or jsonb_array_length(v_form_schema)<1 or jsonb_array_length(v_form_schema)>30 then raise exception 'Feedback form schema is invalid' using errcode='22023'; end if;
  if exists (select 1 from jsonb_object_keys(p_answers) as keys(answer_key)
    where not exists(select 1 from jsonb_array_elements(v_form_schema) q(value) where q.value->>'id'=answer_key)) then
    raise exception 'Response contains an unknown question' using errcode='22023';
  end if;
  for v_question in select value from jsonb_array_elements(v_form_schema)
  loop
    v_value := p_answers -> (v_question->>'id');
    if coalesce((v_question->>'required')::boolean,true) and (v_value is null or v_value='null'::jsonb or v_value='""'::jsonb) then
      raise exception 'A required question is unanswered' using errcode='22023';
    end if;
    if v_value is null or v_value='null'::jsonb or v_value='""'::jsonb then continue; end if;
    case v_question->>'type'
      when 'rating' then
        if jsonb_typeof(v_value)<>'number' then raise exception 'Rating must be a whole number from 1 to 5' using errcode='22023'; end if;
        if (v_value#>>'{}') !~ '^[0-9]+$' or (v_value#>>'{}')::numeric not between 1 and 5 then raise exception 'Rating must be a whole number from 1 to 5' using errcode='22023'; end if;
      when 'number' then
        if jsonb_typeof(v_value)<>'number' then raise exception 'Numeric answer is invalid' using errcode='22023'; end if;
        if (v_value#>>'{}') !~ '^-?[0-9]+([.][0-9]+)?$' or abs((v_value#>>'{}')::numeric)>1000000 then raise exception 'Numeric answer is invalid' using errcode='22023'; end if;
      when 'text','textarea' then
        if jsonb_typeof(v_value)<>'string' or char_length(v_value#>>'{}')>2000 then raise exception 'Written answer is invalid' using errcode='22023'; end if;
      when 'single_choice' then
        if jsonb_typeof(v_value)<>'string' or jsonb_typeof(v_question->'options')<>'array' then raise exception 'Choice answer is invalid' using errcode='22023'; end if;
        if not exists(select 1 from jsonb_array_elements_text(v_question->'options') opt(value) where opt.value=v_value#>>'{}') then raise exception 'Choice answer is invalid' using errcode='22023'; end if;
      when 'multiple_choice' then
        if jsonb_typeof(v_value)<>'array' or jsonb_typeof(v_question->'options')<>'array' then raise exception 'Multiple-choice answer is invalid' using errcode='22023'; end if;
        if jsonb_array_length(v_value)>20 or (coalesce((v_question->>'required')::boolean,true) and jsonb_array_length(v_value)=0) then raise exception 'Multiple-choice answer is invalid' using errcode='22023'; end if;
        if exists(select 1 from jsonb_array_elements(v_value) chosen(value) where jsonb_typeof(chosen.value)<>'string' or not exists(select 1 from jsonb_array_elements_text(v_question->'options') opt(value) where opt.value=chosen.value#>>'{}')) then raise exception 'Multiple-choice answer is invalid' using errcode='22023'; end if;
      else raise exception 'Unsupported question type' using errcode='22023';
    end case;
  end loop;
  insert into private.feedback_eligibility(feedback_id,student_id) values(p_feedback_id,v_student_id) on conflict(feedback_id,student_id) do nothing;
  update private.feedback_eligibility set consumed=true where feedback_id=p_feedback_id and student_id=v_student_id and consumed=false returning true into v_claimed;
  if coalesce(v_claimed,false)=false then raise exception 'Feedback already submitted' using errcode='23505'; end if;
  insert into public.anonymous_submissions(feedback_id,answers) values(p_feedback_id,p_answers);
end;
$$;

create or replace function private.admin_update_user(p_user_id uuid, p_role public.app_role, p_is_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_old_role public.app_role;
  v_old_active boolean;
begin
  if not private.is_admin() or (auth.jwt()->>'aal') <> 'aal2' then raise exception 'Administrator role with MFA is required' using errcode='42501'; end if;
  select role,is_active into v_old_role,v_old_active from public.users where id=p_user_id for update;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;
  if p_user_id=(select auth.uid()) and (p_role<>'ADMIN'::public.app_role or p_is_active=false) then
    raise exception 'You cannot remove your own active administrator access' using errcode='42501';
  end if;
  if v_old_role='ADMIN'::public.app_role and v_old_active and (p_role<>'ADMIN'::public.app_role or p_is_active=false)
    and (select count(*) from public.users where role='ADMIN'::public.app_role and is_active=true)<=1 then
    raise exception 'The last active administrator cannot be demoted or suspended' using errcode='23514';
  end if;
  update public.users set role=p_role,is_active=p_is_active,suspended_at=case when p_is_active then null else coalesce(suspended_at,now()) end where id=p_user_id;
  insert into public.audit_logs(actor_id,action,target_type,target_id,details)
  values((select auth.uid()),'user.access.updated','user',p_user_id,jsonb_build_object('old_role',v_old_role,'new_role',p_role,'was_active',v_old_active,'is_active',p_is_active));
end;
$$;
revoke all on function private.admin_update_user(uuid,public.app_role,boolean) from public,anon,authenticated;
grant execute on function private.admin_update_user(uuid,public.app_role,boolean) to authenticated;
create or replace function public.admin_update_user(p_user_id uuid,p_role public.app_role,p_is_active boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_update_user(p_user_id,p_role,p_is_active) $$;
revoke all on function public.admin_update_user(uuid,public.app_role,boolean) from public,anon;
grant execute on function public.admin_update_user(uuid,public.app_role,boolean) to authenticated;

-- Include privileged user changes in the existing per-user mutation limiter.
alter table private.api_rate_limits drop constraint if exists api_rate_limits_action_check;
alter table private.api_rate_limits add constraint api_rate_limits_action_check
check (action in ('courses:create','feedback:create','responses:submit','admin:user-update'));
create or replace function private.consume_api_rate_limit(p_action text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_window_start timestamptz;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_action not in ('courses:create','feedback:create','responses:submit','admin:user-update')
    or p_limit<1 or p_limit>100 or p_window_seconds<1 or p_window_seconds>86400 then
    raise exception 'Invalid rate limit configuration' using errcode='22023';
  end if;
  v_window_start := to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into private.api_rate_limits(user_id,action,window_start,request_count) values(v_user_id,p_action,v_window_start,1)
  on conflict(user_id,action,window_start) do update set request_count=private.api_rate_limits.request_count+1
  returning request_count into v_count;
  return v_count<=p_limit;
end;
$$;
revoke all on function private.consume_api_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function private.consume_api_rate_limit(text,integer,integer) to authenticated;
