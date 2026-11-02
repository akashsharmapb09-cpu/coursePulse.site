-- MFA-gated user department assignment with an atomic audit event.
create or replace function private.admin_assign_user_department(
  p_user_id uuid,
  p_department_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_department_id uuid;
begin
  if not private.is_admin() or (select auth.jwt()->>'aal') <> 'aal2' then
    raise exception 'Administrator role with MFA is required' using errcode='42501';
  end if;

  select u.department_id
  into v_old_department_id
  from public.users u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception 'User not found' using errcode='P0002';
  end if;

  if p_department_id is not null and not exists (
    select 1 from public.departments d where d.id = p_department_id
  ) then
    raise exception 'Department not found' using errcode='P0002';
  end if;

  update public.users
  set department_id = p_department_id
  where id = p_user_id;

  perform private.admin_record_audit(
    'user.department.updated',
    'user',
    p_user_id,
    jsonb_build_object(
      'old_department_id', v_old_department_id,
      'new_department_id', p_department_id
    )
  );
end;
$$;

revoke all on function private.admin_assign_user_department(uuid, uuid) from public, anon, authenticated;
grant execute on function private.admin_assign_user_department(uuid, uuid) to authenticated;

create or replace function public.admin_assign_user_department(
  p_user_id uuid,
  p_department_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_assign_user_department(p_user_id, p_department_id)
$$;

revoke all on function public.admin_assign_user_department(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_user_department(uuid, uuid) to authenticated;
