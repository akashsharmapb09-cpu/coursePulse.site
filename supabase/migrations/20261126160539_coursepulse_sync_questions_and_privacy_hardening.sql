-- Synchronize normalized question definitions into active feedback forms and
-- harden the de-identified anonymous response projection.

create or replace function private.sync_question_catalog_to_feedback(p_course_id uuid default null)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := private.current_organization_id();
  v_form record;
  v_schema jsonb;
  v_count integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor access required' using errcode = '42501';
  end if;
  if p_course_id is not null and not (private.is_admin() or private.is_course_owner(p_course_id)) then
    raise exception 'Course is not assigned to this instructor' using errcode = '42501';
  end if;
  for v_form in
    select f.id, f.course_id from public.feedback f
    where f.organization_id = v_org and (p_course_id is null or f.course_id = p_course_id)
      and (private.is_admin() or private.is_course_owner(f.course_id))
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', catalog.answer_key, 'label', catalog.label, 'type', catalog.type,
      'required', catalog.is_required, 'options', catalog.options, 'category', catalog.category
    ) order by catalog.order_index, catalog.answer_key), '[]'::jsonb)
    into v_schema
    from (
      select distinct on (q.answer_key) q.*
      from public.questions q
      where q.organization_id = v_org and q.is_active = true
        and (q.feedback_id = v_form.id
          or (q.feedback_id is null and q.course_id = v_form.course_id)
          or (q.feedback_id is null and q.course_id is null))
      order by q.answer_key,
        case when q.feedback_id = v_form.id then 1 when q.course_id = v_form.course_id then 2 else 3 end,
        q.order_index
    ) catalog;
    if jsonb_array_length(v_schema) > 0 then
      update public.feedback set form_schema = v_schema, updated_at = now()
      where id = v_form.id and organization_id = v_org;
    else
      update public.feedback set form_schema = '[]'::jsonb, is_open = false, updated_at = now()
      where id = v_form.id and organization_id = v_org;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;
revoke all on function private.sync_question_catalog_to_feedback(uuid) from public, anon;
grant execute on function private.sync_question_catalog_to_feedback(uuid) to authenticated;

create or replace function public.get_course_instructor_names(p_course_ids uuid[])
returns table(course_id uuid, instructor_name text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor access required' using errcode = '42501';
  end if;
  if p_course_ids is null or cardinality(p_course_ids) < 1 or cardinality(p_course_ids) > 10 then
    raise exception 'Select between 1 and 10 courses' using errcode = '22023';
  end if;
  return query
  select c.id, coalesce(string_agg(distinct instructor.full_name, ', ' order by instructor.full_name), 'Unassigned')::text
  from public.courses c
  left join lateral (
    select u.full_name from public.users u where u.id = c.instructor_id
    union
    select assigned.full_name from public.instructor_course_assignments a
      join public.users assigned on assigned.id = a.instructor_id
      where a.course_id = c.id and a.organization_id = c.organization_id
  ) instructor on true
  where c.id = any(p_course_ids) and c.organization_id = private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(c.id))
  group by c.id;
end;
$function$;
revoke all on function public.get_course_instructor_names(uuid[]) from public, anon;
grant execute on function public.get_course_instructor_names(uuid[]) to authenticated;

create or replace function private.capture_anonymous_feedback_projection()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_course_id uuid;
  v_org uuid;
  v_comment text;
  v_ratings jsonb;
begin
  select f.course_id, f.organization_id into v_course_id, v_org
  from public.feedback f where f.id = new.feedback_id;
  if v_course_id is null or v_org is null then
    raise exception 'Feedback form not found for anonymous response' using errcode = '23503';
  end if;

  with scoped_questions as (
    select distinct on (q.answer_key) q.answer_key, q.label, q.type, q.order_index
    from public.questions q
    where q.organization_id = v_org and q.is_active = true
      and (q.feedback_id = new.feedback_id
        or (q.feedback_id is null and q.course_id = v_course_id)
        or (q.feedback_id is null and q.course_id is null))
    order by q.answer_key,
      case when q.feedback_id = new.feedback_id then 1 when q.course_id = v_course_id then 2 else 3 end,
      q.order_index
  )
  select
    (select string_agg(sq.label || ': ' || (new.answers ->> sq.answer_key), E'\n' order by sq.order_index)
     from scoped_questions sq where sq.type in ('text','textarea')
       and jsonb_typeof(new.answers -> sq.answer_key) = 'string'
       and char_length(btrim(new.answers ->> sq.answer_key)) > 0),
    (select coalesce(jsonb_object_agg(sq.answer_key, new.answers -> sq.answer_key), '{}'::jsonb)
     from scoped_questions sq where sq.type = 'rating'
       and jsonb_typeof(new.answers -> sq.answer_key) = 'number'
       and (new.answers ->> sq.answer_key) ~ '^[1-5]$')
  into v_comment, v_ratings;

  v_comment := regexp_replace(coalesce(v_comment, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', '[redacted email]', 'gi');
  v_comment := regexp_replace(v_comment, '(\+?[0-9][0-9 ()-]{6,}[0-9])', '[redacted phone]', 'g');
  v_comment := regexp_replace(v_comment, '[0-9]{10,12}', '[redacted number]', 'g');
  v_comment := regexp_replace(v_comment, '(roll[[:space:]_-]*(number|no|#)?[[:space:]#:-]*[[:alnum:]/-]{3,})', '[redacted student identifier]', 'gi');
  v_comment := regexp_replace(v_comment, '(student[[:space:]_-]*(id|number|no)[[:space:]#:-]*[[:alnum:]/-]{3,})', '[redacted student identifier]', 'gi');
  v_comment := regexp_replace(v_comment, 'https?://[^[:space:]]+', '[redacted link]', 'gi');

  insert into public.feedback_submissions(feedback_id, course_id, organization_id, created_at, comment, ratings_json)
  values(new.feedback_id, v_course_id, v_org, (new.received_on::timestamp at time zone 'UTC'),
    coalesce(v_comment,''), coalesce(v_ratings,'{}'::jsonb));
  return new;
end;
$function$;
revoke all on function private.capture_anonymous_feedback_projection() from public, anon, authenticated, service_role;
