create index if not exists course_enrollments_enrolled_by_idx on public.course_enrollments(enrolled_by);
create index if not exists instructor_assignments_assigned_by_idx on public.instructor_course_assignments(assigned_by);
