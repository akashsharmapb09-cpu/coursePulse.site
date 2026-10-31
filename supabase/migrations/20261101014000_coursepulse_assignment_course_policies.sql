-- Instructor course assignments grant scoped teaching access to assigned courses.
drop policy if exists courses_update_owner_or_admin on public.courses;
create policy courses_update_owner_or_admin on public.courses for update to authenticated
using ((select private.is_admin()) or (select private.is_course_owner(id)))
with check ((select private.is_admin()) or (select private.is_course_owner(id)));

drop policy if exists courses_delete_owner_or_admin on public.courses;
create policy courses_delete_owner_or_admin on public.courses for delete to authenticated
using ((select private.is_admin()) or (select private.is_course_owner(id)));
