-- The existing application uses public.users as its canonical identity
-- record. Expose the requested Student/Instructor profile shape as a separate
-- RLS-protected table, kept in sync by a trigger. Legacy HOD/Admin accounts
-- remain in users and are intentionally not exposed as a third public role.

drop view if exists public.profiles;

create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  full_name text not null default '',
  username text,
  programme text,
  role text not null check (role in ('student','instructor')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on table public.profiles from public, anon, authenticated, service_role;
grant select on table public.profiles to authenticated;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create or replace function private.sync_student_instructor_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
begin
  if new.role in ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role) then
    insert into public.profiles(id,full_name,username,programme,role,updated_at)
    values(
      new.id,
      coalesce(new.full_name,''),
      new.username,
      new.program,
      lower(new.role::text),
      now()
    )
    on conflict(id) do update set
      full_name=excluded.full_name,
      username=excluded.username,
      programme=excluded.programme,
      role=excluded.role,
      updated_at=now();
  else
    delete from public.profiles where id=new.id;
  end if;
  return new;
end;
$function$;
revoke all on function private.sync_student_instructor_profile() from public, anon, authenticated, service_role;

drop trigger if exists users_sync_student_instructor_profile on public.users;
create trigger users_sync_student_instructor_profile
after insert or update of full_name,username,program,role on public.users
for each row execute function private.sync_student_instructor_profile();

insert into public.profiles(id,full_name,username,programme,role)
select u.id,coalesce(u.full_name,''),u.username,u.program,lower(u.role::text)
from public.users u
where u.role in ('STUDENT'::public.app_role,'INSTRUCTOR'::public.app_role)
on conflict(id) do update set
  full_name=excluded.full_name,
  username=excluded.username,
  programme=excluded.programme,
  role=excluded.role,
  updated_at=now();
