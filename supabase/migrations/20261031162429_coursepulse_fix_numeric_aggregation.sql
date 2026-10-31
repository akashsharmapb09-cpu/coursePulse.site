create or replace function public.get_instructor_aggregates(p_course_id uuid default null)
returns table (
  course_id uuid, course_title text, feedback_id uuid, feedback_title text,
  question_id text, question_label text, question_type text, option_value text,
  response_count bigint, avg_numeric_value numeric
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if public.current_app_role() not in ('INSTRUCTOR'::public.app_role,'ADMIN'::public.app_role) then
    raise exception 'Instructor or admin role required' using errcode='42501';
  end if;
  return query
  with question_values as (
    select c.id as c_id,c.title as c_title,f.id as f_id,f.title as f_title,
      q.value->>'id' as q_id,q.value->>'label' as q_label,q.value->>'type' as q_type,
      r.id as response_id,a.answer_value
    from public.courses c join public.feedback f on f.course_id=c.id
    cross join lateral jsonb_array_elements(f.form_schema) q(value)
    left join public.responses r on r.feedback_id=f.id
    left join lateral (
      select jsonb_array_elements_text(r.answers->(q.value->>'id')) as answer_value
      where jsonb_typeof(r.answers->(q.value->>'id'))='array'
      union all
      select r.answers->>(q.value->>'id') as answer_value
      where r.answers ? (q.value->>'id') and jsonb_typeof(r.answers->(q.value->>'id')) <> 'array'
    ) a on true
    where (p_course_id is null or c.id=p_course_id)
      and (public.is_admin() or (public.is_instructor() and c.instructor_id=(select auth.uid())))
  ), normalised as (
    select q.*,
      case when q_type in ('text','textarea','long_text','rating','number') then null::text else answer_value end as grouped_option,
      case when q_type in ('rating','number') and answer_value ~ '^-?[0-9]+(\\.[0-9]+)?$'
        then answer_value::numeric else null::numeric end as numeric_answer
    from question_values q
  )
  select n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option,
    count(distinct n.response_id)::bigint,
    case when n.q_type in ('rating','number') then avg(n.numeric_answer) else null::numeric end
  from normalised n
  group by n.c_id,n.c_title,n.f_id,n.f_title,n.q_id,n.q_label,n.q_type,n.grouped_option
  having count(distinct n.response_id)>=5;
end;
$$;
revoke all on function public.get_instructor_aggregates(uuid) from public,anon;
grant execute on function public.get_instructor_aggregates(uuid) to authenticated;
comment on function public.get_instructor_aggregates(uuid) is 'Aggregate-only reporting. Suppresses groups under five responses and never returns free-text answers.';
