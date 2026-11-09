-- Tighten Student Voice policy shape and index review/audit foreign keys.
drop policy student_suggestions_student_read on public.student_suggestions;
drop policy student_suggestions_admin_read on public.student_suggestions;

create policy student_suggestions_read
  on public.student_suggestions for select to authenticated
  using (
    (select private.is_admin())
    or (
      student_id = (select auth.uid())
      and (select private.current_app_role()) = 'STUDENT'::public.app_role
    )
  );

create index student_suggestions_reviewed_by_idx
  on public.student_suggestions(reviewed_by)
  where reviewed_by is not null;

create index teacher_notifications_created_by_idx
  on public.teacher_notifications(created_by);
