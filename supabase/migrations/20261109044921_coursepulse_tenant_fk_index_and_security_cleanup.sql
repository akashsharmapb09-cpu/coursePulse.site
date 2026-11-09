-- Tighten tenant helper execution and complete foreign-key indexing.
drop policy if exists platform_admins_deny_client_access on private.platform_admins;
create policy platform_admins_deny_client_access
  on private.platform_admins for all to authenticated
  using (false) with check (false);

do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end
$migration$;

create or replace function private.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_app_role() = 'INSTRUCTOR'::public.app_role
    and private.current_organization_id() is not null,
    false
  )
$$;
revoke all on function private.is_instructor() from public, anon;
grant execute on function private.is_instructor() to authenticated;

do $$
declare
  fk record;
  index_name text;
  column_list text;
begin
  for fk in
    select c.oid, c.conname, c.conrelid, ns.nspname as schema_name, rel.relname as table_name,
      array_agg(att.attname order by cols.ordinality) as column_names
    from pg_constraint c
    join pg_class rel on rel.oid=c.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    cross join lateral unnest(c.conkey) with ordinality as cols(attnum,ordinality)
    join pg_attribute att on att.attrelid=c.conrelid and att.attnum=cols.attnum
    where c.contype='f' and ns.nspname in ('public','private')
    group by c.oid,c.conname,c.conrelid,ns.nspname,rel.relname
  loop
    index_name := left('idx_'||fk.table_name||'_'||fk.conname, 58);
    select string_agg(format('%I', value), ', ') into column_list
      from unnest(fk.column_names) as value;
    execute format('create index if not exists %I on %I.%I (%s)',
      index_name,fk.schema_name,fk.table_name,column_list);
  end loop;
end
$$;

create index if not exists instructor_course_assignments_organization_id_idx
  on public.instructor_course_assignments(organization_id);
create index if not exists teacher_notifications_recipient_org_idx
  on public.teacher_notifications(recipient_id,organization_id);
