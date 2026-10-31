create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.current_app_role()
returns public.app_role language sql stable security definer set search_path = ''
as $$ select u.role from public.users u where u.id=(select auth.uid()) limit 1 $$;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role()='ADMIN'::public.app_role,false) $$;
create or replace function private.is_instructor()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role()='INSTRUCTOR'::public.app_role,false) $$;
create or replace function private.is_course_owner(p_course_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.courses c where c.id=p_course_id and c.instructor_id=(select auth.uid())) and private.is_instructor() $$;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_instructor() to authenticated;
grant execute on function private.is_course_owner(uuid) to authenticated;

-- Replace exposed helper calls in RLS with equivalent private-schema functions.
drop policy if exists users_select_self_or_admin on public.users;
drop policy if exists courses_select_scoped on public.courses;
drop policy if exists courses_insert_owner_or_admin on public.courses;
drop policy if exists courses_update_owner_or_admin on public.courses;
drop policy if exists courses_delete_owner_or_admin on public.courses;
drop policy if exists feedback_select_scoped on public.feedback;
drop policy if exists feedback_insert_course_owner on public.feedback;
drop policy if exists feedback_update_course_owner on public.feedback;
drop policy if exists feedback_delete_course_owner on public.feedback;
drop policy if exists responses_insert_self_only on public.responses;
drop policy if exists responses_select_own_or_admin on public.responses;

create policy users_select_self_or_admin on public.users for select to authenticated
using(id=(select auth.uid()) or (select private.is_admin()));
create policy courses_select_scoped on public.courses for select to authenticated
using((select private.is_admin()) or instructor_id=(select auth.uid()) or (status='PUBLISHED'::public.course_status and (select private.current_app_role())='STUDENT'::public.app_role));
create policy courses_insert_owner_or_admin on public.courses for insert to authenticated
with check((select private.is_admin()) or ((select private.is_instructor()) and instructor_id=(select auth.uid())));
create policy courses_update_owner_or_admin on public.courses for update to authenticated
using((select private.is_admin()) or ((select private.is_instructor()) and instructor_id=(select auth.uid())))
with check((select private.is_admin()) or ((select private.is_instructor()) and instructor_id=(select auth.uid())));
create policy courses_delete_owner_or_admin on public.courses for delete to authenticated
using((select private.is_admin()) or ((select private.is_instructor()) and instructor_id=(select auth.uid())));
create policy feedback_select_scoped on public.feedback for select to authenticated
using((select private.is_admin()) or (select private.is_course_owner(course_id)) or
  (is_open=true and (select private.current_app_role())='STUDENT'::public.app_role and exists(select 1 from public.courses c where c.id=feedback.course_id and c.status='PUBLISHED'::public.course_status)));
create policy feedback_insert_course_owner on public.feedback for insert to authenticated
with check(created_by=(select auth.uid()) and ((select private.is_admin()) or (select private.is_course_owner(course_id))));
create policy feedback_update_course_owner on public.feedback for update to authenticated
using((select private.is_admin()) or (select private.is_course_owner(course_id)))
with check((select private.is_admin()) or (select private.is_course_owner(course_id)));
create policy feedback_delete_course_owner on public.feedback for delete to authenticated
using((select private.is_admin()) or (select private.is_course_owner(course_id)));
create policy responses_select_own_or_admin on public.responses for select to authenticated
using(student_id=(select auth.uid()) or (select private.is_admin()));
create policy responses_insert_self_only on public.responses for insert to authenticated
with check(student_id=(select auth.uid()) and (select private.current_app_role())='STUDENT'::public.app_role and exists(
  select 1 from public.feedback f join public.courses c on c.id=f.course_id where f.id=responses.feedback_id and f.is_open=true and c.status='PUBLISHED'::public.course_status));

revoke all on function public.current_app_role() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_instructor() from public, anon, authenticated;
revoke all on function public.is_course_owner(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop function if exists public.is_course_owner(uuid);
drop function if exists public.is_instructor();
drop function if exists public.is_admin();
drop function if exists public.current_app_role();

create or replace function private.get_instructor_aggregates(p_course_id uuid default null)
returns table(course_id uuid,course_title text,feedback_id uuid,feedback_title text,question_id text,question_label text,question_type text,option_value text,response_count bigint,avg_numeric_value numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if private.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then raise exception 'Instructor or admin role required' using errcode='42501'; end if;
 return query
 with question_values as (
  select c.id as c_id,c.title as c_title,f.id as f_id,f.title as f_title,q.value->>'id' as q_id,q.value->>'label' as q_label,q.value->>'type' as q_type,r.id as response_id,a.answer_value
  from public.courses c join public.feedback f on f.course_id=c.id cross join lateral jsonb_array_elements(f.form_schema) q(value)
  left join public.responses r on r.feedback_id=f.id
  left join lateral (
   select jsonb_array_elements_text(r.answers->(q.value->>'id')) as answer_value where jsonb_typeof(r.answers->(q.value->>'id'))='array'
   union all select r.answers->>(q.value->>'id') as answer_value where r.answers ? (q.value->>'id') and jsonb_typeof(r.answers->(q.value->>'id'))<>'array'
  ) a on true
  where (p_course_id is null or c.id=p_course_id) and (private.is_admin() or (private.is_instructor() and c.instructor_id=(select auth.uid())))
 ), normalised as (
  select q.*,case when q_type in ('text','textarea','long_text','rating','number') then null::text else answer_value end as grouped_option,
   case when q_type in ('rating','number') and answer_value ~ '^-?[0-9]+(\\.[0-9]+)?$' then answer_value::numeric else null::numeric end as numeric_answer
  from question_values q
 )
 select n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option,count(distinct n.response_id)::bigint,
  case when n.q_type in ('rating','number') then avg(n.numeric_answer) else null::numeric end
 from normalised n group by n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option
 having count(distinct n.response_id)>=5;
end;
$$;
revoke all on function private.get_instructor_aggregates(uuid) from public,anon;
grant execute on function private.get_instructor_aggregates(uuid) to authenticated;
create or replace function public.get_instructor_aggregates(p_course_id uuid default null)
returns table(course_id uuid,course_title text,feedback_id uuid,feedback_title text,question_id text,question_label text,question_type text,option_value text,response_count bigint,avg_numeric_value numeric)
language sql stable security invoker set search_path = '' as $$ select * from private.get_instructor_aggregates(p_course_id) $$;
revoke all on function public.get_instructor_aggregates(uuid) from public,anon;
grant execute on function public.get_instructor_aggregates(uuid) to authenticated;

create extension if not exists pg_cron;
select cron.schedule('coursepulse-retention-cleanup','17 20 * * *','select public.cleanup_expired_responses()');
