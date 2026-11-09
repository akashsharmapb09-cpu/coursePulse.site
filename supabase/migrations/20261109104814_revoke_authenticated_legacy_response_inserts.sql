-- CoursePulse F-01: remove the weaker direct client write path.
-- Preserve SELECT permissions and the restrictive tenant-boundary policy.
revoke insert on table public.responses from authenticated;
drop policy if exists responses_insert_self_only on public.responses;

do $$
begin
  if has_table_privilege('authenticated', 'public.responses', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.responses', 'INSERT') then
    raise exception 'F-01 not closed: authenticated still has table/column INSERT';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'responses'
      and permissive = 'PERMISSIVE'
      and cmd in ('INSERT', 'ALL')
      and (roles @> array['authenticated']::name[] or roles @> array['public']::name[])
  ) then
    raise exception 'F-01 not closed: authenticated still has a permissive INSERT/ALL policy';
  end if;

  if not has_table_privilege('authenticated', 'public.responses', 'SELECT') then
    raise exception 'Compatibility regression: authenticated lost legacy SELECT';
  end if;
end;
$$;
