drop index if exists public.anonymous_submissions_submitted_at_idx;
alter table public.anonymous_submissions drop column if exists submitted_at;

do $$
declare v_definition text;
begin
  select pg_get_functiondef('private.get_instructor_aggregates_filtered(uuid,date,date,uuid,uuid)'::regprocedure) into v_definition;
  if position('a.submitted_at::date as submitted_on' in v_definition)=0 then raise exception 'Could not locate anonymous aggregate date projection'; end if;
  v_definition:=replace(v_definition,'a.submitted_at::date as submitted_on','a.received_on as submitted_on');
  execute v_definition;

  select pg_get_functiondef('private.get_instructor_rating_distribution_filtered(uuid,date,date,uuid,uuid)'::regprocedure) into v_definition;
  if position('a.submitted_at::date as submitted_on' in v_definition)=0 then raise exception 'Could not locate anonymous rating date projection'; end if;
  v_definition:=replace(v_definition,'a.submitted_at::date as submitted_on','a.received_on as submitted_on');
  execute v_definition;

  select pg_get_functiondef('private.get_instructor_response_trends_filtered(uuid,date,date,uuid,uuid)'::regprocedure) into v_definition;
  if position('a.submitted_at from public.anonymous_submissions a' in v_definition)=0 then raise exception 'Could not locate anonymous trend date projection'; end if;
  v_definition:=replace(v_definition,'a.submitted_at from public.anonymous_submissions a','a.received_on::timestamp from public.anonymous_submissions a');
  execute v_definition;
end;
$$;

revoke all on function private.get_instructor_aggregates_filtered(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_aggregates_filtered(uuid,date,date,uuid,uuid) to authenticated;
revoke all on function private.get_instructor_rating_distribution_filtered(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_rating_distribution_filtered(uuid,date,date,uuid,uuid) to authenticated;
revoke all on function private.get_instructor_response_trends_filtered(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_instructor_response_trends_filtered(uuid,date,date,uuid,uuid) to authenticated;
