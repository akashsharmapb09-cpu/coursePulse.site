-- Remove the owner-privileged view and expose only a de-identified projection.
drop view if exists public.feedback_submissions;

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
create index if not exists feedback_submissions_filter_idx
  on public.feedback_submissions (organization_id, course_id, feedback_id, created_at);
alter table public.feedback_submissions enable row level security;
alter table public.feedback_submissions force row level security;
revoke all on table public.feedback_submissions from public, anon, authenticated, service_role;
grant select on table public.feedback_submissions to authenticated;

create or replace function private.feedback_submission_group_reportable(p_feedback_id uuid, p_organization_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' set row_security = off
as $function$
declare
  v_course_id uuid;
  v_count bigint;
begin
  if (select auth.uid()) is null
     or private.current_app_role() not in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role)
     or p_organization_id <> private.current_organization_id() then
    return false;
  end if;
  select f.course_id into v_course_id from public.feedback f
    where f.id = p_feedback_id and f.organization_id = p_organization_id;
  if v_course_id is null or not (private.is_admin() or private.is_course_owner(v_course_id)) then return false; end if;
  select count(*) into v_count from public.feedback_submissions s
    where s.feedback_id = p_feedback_id and s.organization_id = p_organization_id;
  return v_count >= 5;
end;
$function$;
revoke all on function private.feedback_submission_group_reportable(uuid, uuid) from public, anon;
grant execute on function private.feedback_submission_group_reportable(uuid, uuid) to authenticated;

drop policy if exists feedback_submissions_instructor_read on public.feedback_submissions;
create policy feedback_submissions_instructor_read on public.feedback_submissions for select to authenticated
using (
  organization_id = private.current_organization_id()
  and private.current_app_role() in ('INSTRUCTOR'::public.app_role, 'ADMIN'::public.app_role)
  and (private.is_admin() or private.is_course_owner(course_id))
  and private.feedback_submission_group_reportable(feedback_id, organization_id)
);

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
  v_comment := regexp_replace(v_comment, 'https?://[^[:space:]]+', '[redacted link]', 'gi');

  insert into public.feedback_submissions (feedback_id, course_id, organization_id, created_at, comment, ratings_json)
  values (new.feedback_id, v_course_id, v_org, (new.received_on::timestamp at time zone 'UTC'),
    v_comment, coalesce(v_ratings, '{}'::jsonb));
  return new;
end;
$function$;
revoke all on function private.capture_anonymous_feedback_projection() from public, anon, authenticated, service_role;
drop trigger if exists anonymous_submissions_capture_projection on public.anonymous_submissions;
create trigger anonymous_submissions_capture_projection
after insert on public.anonymous_submissions
for each row execute function private.capture_anonymous_feedback_projection();

drop policy if exists submission_tracker_deny_api on private.submission_tracker;
create policy submission_tracker_deny_api on private.submission_tracker for all to anon, authenticated
using (false) with check (false);
