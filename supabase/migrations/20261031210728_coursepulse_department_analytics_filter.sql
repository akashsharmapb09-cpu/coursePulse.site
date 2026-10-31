do $$
declare v_definition text; v_old text;
begin
  select pg_get_functiondef('private.get_instructor_aggregates_filtered(uuid,date,date,uuid)'::regprocedure) into v_definition;
  v_old := 'private.get_instructor_aggregates_filtered(p_course_id uuid DEFAULT NULL::uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_semester_id uuid DEFAULT NULL::uuid)';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate aggregate function signature'; end if;
  v_definition := replace(v_definition,v_old,'private.get_instructor_aggregates_filtered(p_course_id uuid DEFAULT NULL::uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_semester_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid)');
  v_old := 'and (p_semester_id is null or c.semester_id = p_semester_id)';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate semester filter'; end if;
  v_definition := replace(v_definition,v_old,v_old||E'\n      and (p_department_id is null or c.department_id = p_department_id)');
  execute v_definition;

  select pg_get_functiondef('private.get_instructor_rating_distribution_filtered(uuid,date,date,uuid)'::regprocedure) into v_definition;
  v_old := 'private.get_instructor_rating_distribution_filtered(p_course_id uuid DEFAULT NULL::uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_semester_id uuid DEFAULT NULL::uuid)';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate rating distribution function signature'; end if;
  v_definition := replace(v_definition,v_old,'private.get_instructor_rating_distribution_filtered(p_course_id uuid DEFAULT NULL::uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_semester_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid)');
  v_old := 'and (p_semester_id is null or c.semester_id=p_semester_id)';
  if position(v_old in v_definition)=0 then raise exception 'Could not locate rating semester filter'; end if;
  v_definition := replace(v_definition,v_old,v_old||E'\n    and (p_department_id is null or c.department_id=p_department_id)');
  execute v_definition;
end;
$$;

revoke all on function private.get_instructor_aggregates_filtered(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_aggregates_filtered(uuid,date,date,uuid,uuid) to authenticated;
create or replace function public.get_instructor_aggregates_filtered(
  p_course_id uuid default null,p_from_date date default null,p_to_date date default null,
  p_semester_id uuid default null,p_department_id uuid default null
)
returns table(course_id uuid,course_title text,feedback_id uuid,feedback_title text,question_id text,question_label text,question_type text,option_value text,response_count bigint,avg_numeric_value numeric)
language sql stable security invoker set search_path=''
as $$ select * from private.get_instructor_aggregates_filtered(p_course_id,p_from_date,p_to_date,p_semester_id,p_department_id) $$;
revoke all on function public.get_instructor_aggregates_filtered(uuid,date,date,uuid,uuid) from public,anon;
grant execute on function public.get_instructor_aggregates_filtered(uuid,date,date,uuid,uuid) to authenticated;

revoke all on function private.get_instructor_rating_distribution_filtered(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_rating_distribution_filtered(uuid,date,date,uuid,uuid) to authenticated;
create or replace function public.get_instructor_rating_distribution_filtered(
  p_course_id uuid default null,p_from_date date default null,p_to_date date default null,
  p_semester_id uuid default null,p_department_id uuid default null
)
returns table(course_id uuid,course_title text,feedback_id uuid,feedback_title text,question_id text,question_label text,rating_value integer,response_count bigint)
language sql stable security invoker set search_path=''
as $$ select * from private.get_instructor_rating_distribution_filtered(p_course_id,p_from_date,p_to_date,p_semester_id,p_department_id) $$;
revoke all on function public.get_instructor_rating_distribution_filtered(uuid,date,date,uuid,uuid) from public,anon;
grant execute on function public.get_instructor_rating_distribution_filtered(uuid,date,date,uuid,uuid) to authenticated;
