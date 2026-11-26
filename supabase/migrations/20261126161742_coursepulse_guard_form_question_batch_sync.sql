-- Batch form-schema replacement should synchronize only after all its question
-- rows have been replaced. Direct catalogue changes still use the table trigger.
create or replace function private.sync_feedback_form_questions(p_feedback_id uuid, p_questions jsonb)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_course_id uuid;
  v_organization_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role) then
    raise exception 'Instructor access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 30 then
    raise exception 'A form must contain between 1 and 30 questions' using errcode = '22023';
  end if;

  select f.course_id, f.organization_id into v_course_id, v_organization_id
  from public.feedback f
  where f.id = p_feedback_id and f.organization_id = private.current_organization_id()
    and (private.is_admin() or private.is_course_owner(f.course_id))
  for update;
  if v_course_id is null then raise exception 'Feedback form not found or not editable' using errcode = '42501'; end if;

  perform set_config('coursepulse.sync_questions', 'off', true);
  delete from public.questions q
  where q.feedback_id = p_feedback_id and q.organization_id = v_organization_id;

  insert into public.questions(
    organization_id, course_id, feedback_id, answer_key, label, type,
    order_index, is_active, is_required, options, category, created_by
  )
  select
    v_organization_id, v_course_id, p_feedback_id, left(value->>'id', 120),
    left(btrim(value->>'label'), 180), value->>'type', (ordinality - 1)::integer,
    true, coalesce((value->>'required')::boolean, true),
    case when jsonb_typeof(value->'options')='array' then value->'options' else '[]'::jsonb end,
    left(value->>'category', 80), (select auth.uid())
  from jsonb_array_elements(p_questions) with ordinality as q(value, ordinality)
  where coalesce(value->>'id','') <> ''
    and char_length(btrim(coalesce(value->>'label',''))) between 2 and 180
    and value->>'type' in ('rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no');

  if not found then raise exception 'No valid questions were provided' using errcode = '22023'; end if;

  perform set_config('coursepulse.sync_questions', 'on', true);
  perform private.sync_question_catalog_to_feedback(v_course_id);
end;
$function$;
revoke all on function private.sync_feedback_form_questions(uuid, jsonb) from public, anon;
grant execute on function private.sync_feedback_form_questions(uuid, jsonb) to authenticated;

create or replace function private.refresh_feedback_forms_after_question_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if current_setting('coursepulse.sync_questions', true) = 'off' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.course_id is distinct from new.course_id then
    perform private.sync_question_catalog_to_feedback(old.course_id);
  end if;
  if tg_op = 'DELETE' then
    perform private.sync_question_catalog_to_feedback(old.course_id);
    return old;
  end if;
  perform private.sync_question_catalog_to_feedback(new.course_id);
  return new;
end;
$function$;
revoke all on function private.refresh_feedback_forms_after_question_change() from public, anon, authenticated, service_role;
