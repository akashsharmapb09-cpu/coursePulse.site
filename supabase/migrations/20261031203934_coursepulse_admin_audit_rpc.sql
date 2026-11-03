create or replace function private.admin_record_audit(p_action text,p_target_type text,p_target_id uuid,p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() or (auth.jwt()->>'aal') <> 'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;
  if p_action is null or char_length(p_action) not between 2 and 80
    or p_target_type is null or char_length(p_target_type) not between 2 and 80
    or p_details is null or jsonb_typeof(p_details)<>'object' or pg_column_size(p_details)>4096 then
    raise exception 'Invalid audit event' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_id,action,target_type,target_id,details)
  values((select auth.uid()),p_action,p_target_type,p_target_id,p_details);
end;
$$;
revoke all on function private.admin_record_audit(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.admin_record_audit(text,text,uuid,jsonb) to authenticated;
create or replace function public.admin_record_audit(p_action text,p_target_type text,p_target_id uuid,p_details jsonb default '{}'::jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_record_audit(p_action,p_target_type,p_target_id,p_details) $$;
revoke all on function public.admin_record_audit(text,text,uuid,jsonb) from public,anon;
grant execute on function public.admin_record_audit(text,text,uuid,jsonb) to authenticated;
