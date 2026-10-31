drop policy if exists departments_admin_manage on public.departments;
create policy departments_admin_insert on public.departments for insert to authenticated with check ((select private.is_admin()));
create policy departments_admin_update on public.departments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy departments_admin_delete on public.departments for delete to authenticated using ((select private.is_admin()));

drop policy if exists semesters_admin_manage on public.semesters;
create policy semesters_admin_insert on public.semesters for insert to authenticated with check ((select private.is_admin()));
create policy semesters_admin_update on public.semesters for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy semesters_admin_delete on public.semesters for delete to authenticated using ((select private.is_admin()));

drop policy if exists course_enrollments_admin_manage on public.course_enrollments;
create policy course_enrollments_admin_insert on public.course_enrollments for insert to authenticated with check ((select private.is_admin()));
create policy course_enrollments_admin_update on public.course_enrollments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy course_enrollments_admin_delete on public.course_enrollments for delete to authenticated using ((select private.is_admin()));

drop policy if exists instructor_assignments_admin_manage on public.instructor_course_assignments;
create policy instructor_assignments_admin_insert on public.instructor_course_assignments for insert to authenticated with check ((select private.is_admin()));
create policy instructor_assignments_admin_update on public.instructor_course_assignments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy instructor_assignments_admin_delete on public.instructor_course_assignments for delete to authenticated using ((select private.is_admin()));
