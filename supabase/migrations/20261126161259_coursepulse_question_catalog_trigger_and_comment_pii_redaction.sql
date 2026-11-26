-- Validate all question scope fields on UPDATE and keep form_schema in sync
-- whenever a permitted instructor mutates the normalized catalogue.
drop policy if exists questions_update_instructor on public.questions;
create policy questions_update_instructor on public.questions for update to authenticated
using (
  organization_id = private.current_organization_id()
  and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
)
with check (
  organization_id = private.current_organization_id()
  and (private.is_admin() or (private.is_instructor() and (course_id is null or private.is_course_owner(course_id))))
  and (
    feedback_id is null
    or exists (
      select 1 from public.feedback f
      where f.id = questions.feedback_id and f.course_id = questions.course_id
        and f.organization_id = questions.organization_id
        and (private.is_admin() or private.is_course_owner(f.course_id))
    )
  )
);

create or replace function private.refresh_feedback_forms_after_question_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
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
drop trigger if exists questions_refresh_feedback_forms on public.questions;
create trigger questions_refresh_feedback_forms
after insert or update or delete on public.questions
for each row execute function private.refresh_feedback_forms_after_question_change();

-- Also scrub exact Student name, username and roll-number strings from free text.
-- This is defense in depth; identifiers are never copied into the projection.
create or replace function private.capture_anonymous_feedback_projection()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_course_id uuid;
  v_org uuid;
  v_comment text;
  v_ratings jsonb;
  v_identity text;
  v_student_username text;
  v_student_number text;
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

  for v_identity, v_student_username, v_student_number in
    select distinct token.name_part, u.username, d.student_number
    from public.users u
    left join public.student_directory d
      on d.student_id = u.id and d.organization_id = u.organization_id
    cross join lateral regexp_split_to_table(coalesce(u.full_name,''), E'\\s+') as token(name_part)
    where u.organization_id = v_org and u.role = 'STUDENT'::public.app_role
  loop
    if char_length(coalesce(v_identity,'')) >= 3 then
      v_comment := replace(v_comment, v_identity, '[redacted student name]');
      v_comment := replace(v_comment, lower(v_identity), '[redacted student name]');
      v_comment := replace(v_comment, upper(v_identity), '[redacted student name]');
    end if;
    if char_length(coalesce(v_student_username,'')) >= 4 then
      v_comment := replace(v_comment, v_student_username, '[redacted student username]');
      v_comment := replace(v_comment, lower(v_student_username), '[redacted student username]');
      v_comment := replace(v_comment, upper(v_student_username), '[redacted student username]');
    end if;
    if char_length(coalesce(v_student_number,'')) >= 3 then
      v_comment := replace(v_comment, v_student_number, '[redacted student number]');
    end if;
  end loop;

  insert into public.feedback_submissions(feedback_id, course_id, organization_id, created_at, comment, ratings_json)
  values(new.feedback_id, v_course_id, v_org, (new.received_on::timestamp at time zone 'UTC'),
    coalesce(v_comment,''), coalesce(v_ratings,'{}'::jsonb));
  return new;
end;
$function$;
revoke all on function private.capture_anonymous_feedback_projection() from public, anon, authenticated, service_role;
