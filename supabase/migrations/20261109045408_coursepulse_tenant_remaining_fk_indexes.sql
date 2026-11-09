-- Index the two remaining tenant foreign keys reported by the QA database linter.
create index if not exists instructor_course_assignments_organization_id_idx
  on public.instructor_course_assignments(organization_id);

create index if not exists teacher_notifications_recipient_org_idx
  on public.teacher_notifications(recipient_id,organization_id);
