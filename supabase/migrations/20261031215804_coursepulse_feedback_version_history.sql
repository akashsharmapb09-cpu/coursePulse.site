-- Preserve form-definition snapshots without ever copying student answers.
alter table public.feedback
  add column version integer not null default 1 check (version >= 1);

create table private.feedback_versions (
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  version integer not null check (version >= 1),
  title text not null,
  description text not null,
  form_schema jsonb not null check (jsonb_typeof(form_schema) = 'array' and pg_column_size(form_schema) <= 32768),
  due_at timestamptz,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (feedback_id, version)
);

alter table private.feedback_versions enable row level security;
revoke all on table private.feedback_versions from public, anon, authenticated, service_role;
create policy feedback_versions_deny_direct_access
  on private.feedback_versions for all to anon, authenticated
  using (false) with check (false);

comment on table private.feedback_versions is
  'Immutable snapshots of feedback form definitions only. Student responses and anonymous submissions are never stored here.';

create or replace function private.capture_feedback_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.form_schema is distinct from new.form_schema
    or old.due_at is distinct from new.due_at then
    insert into private.feedback_versions(
      feedback_id, version, title, description, form_schema, due_at, changed_by
    )
    values(
      old.id, old.version, old.title, old.description, old.form_schema, old.due_at,
      (select auth.uid())
    );
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;
revoke all on function private.capture_feedback_version() from public, anon, authenticated, service_role;

drop trigger if exists feedback_capture_version_before_update on public.feedback;
create trigger feedback_capture_version_before_update
before update on public.feedback
for each row execute function private.capture_feedback_version();

create or replace function private.get_feedback_versions(p_feedback_id uuid)
returns table(
  version integer,
  title text,
  description text,
  form_schema jsonb,
  due_at timestamptz,
  changed_by uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  select f.course_id into v_course_id
  from public.feedback f
  where f.id = p_feedback_id;

  if not found then
    raise exception 'Feedback form not found' using errcode = 'P0002';
  end if;

  if not private.is_admin() and not private.is_course_owner(v_course_id) then
    raise exception 'Feedback owner or administrator access required' using errcode = '42501';
  end if;

  return query
  select v.version, v.title, v.description, v.form_schema, v.due_at, v.changed_by, v.created_at
  from private.feedback_versions v
  where v.feedback_id = p_feedback_id
  order by v.version desc;
end;
$$;

revoke all on function private.get_feedback_versions(uuid) from public, anon, authenticated;
grant execute on function private.get_feedback_versions(uuid) to authenticated;

create or replace function public.get_feedback_versions(p_feedback_id uuid)
returns table(
  version integer,
  title text,
  description text,
  form_schema jsonb,
  due_at timestamptz,
  changed_by uuid,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_feedback_versions(p_feedback_id)
$$;
revoke all on function public.get_feedback_versions(uuid) from public, anon;
grant execute on function public.get_feedback_versions(uuid) to authenticated;

create or replace function private.restore_feedback_version(p_feedback_id uuid, p_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_title text;
  v_description text;
  v_form_schema jsonb;
  v_due_at timestamptz;
  v_new_version integer;
begin
  select f.course_id into v_course_id
  from public.feedback f
  where f.id = p_feedback_id
  for update;

  if not found then
    raise exception 'Feedback form not found' using errcode = 'P0002';
  end if;

  if not private.is_admin() and not private.is_course_owner(v_course_id) then
    raise exception 'Feedback owner or administrator access required' using errcode = '42501';
  end if;

  select v.title, v.description, v.form_schema, v.due_at
  into v_title, v_description, v_form_schema, v_due_at
  from private.feedback_versions v
  where v.feedback_id = p_feedback_id
    and v.version = p_version;

  if not found then
    raise exception 'Feedback version not found' using errcode = 'P0002';
  end if;

  update public.feedback
  set title = v_title,
      description = v_description,
      form_schema = v_form_schema,
      due_at = v_due_at
  where id = p_feedback_id
  returning version into v_new_version;

  return v_new_version;
end;
$$;

revoke all on function private.restore_feedback_version(uuid, integer) from public, anon, authenticated;
grant execute on function private.restore_feedback_version(uuid, integer) to authenticated;

create or replace function public.restore_feedback_version(p_feedback_id uuid, p_version integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.restore_feedback_version(p_feedback_id, p_version)
$$;
revoke all on function public.restore_feedback_version(uuid, integer) from public, anon;
grant execute on function public.restore_feedback_version(uuid, integer) to authenticated;
