create or replace function public.get_my_data_deletion_requests()
returns table (
  id uuid,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  resolution_note text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_my_data_deletion_requests();
$function$;

create or replace function public.create_my_data_deletion_request()
returns table (
  id uuid,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  resolution_note text
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.create_my_data_deletion_request();
$function$;

revoke all on function public.get_my_data_deletion_requests() from public, anon;
revoke all on function public.create_my_data_deletion_request() from public, anon;
grant execute on function public.get_my_data_deletion_requests() to authenticated;
grant execute on function public.create_my_data_deletion_request() to authenticated;

comment on function public.get_my_data_deletion_requests() is
  'Returns only the signed-in user account deletion request history.';
comment on function public.create_my_data_deletion_request() is
  'Creates a deletion request for the signed-in user; administrator review and MFA are required for processing.';
