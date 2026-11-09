-- Allow authenticated administrators to import/update course codes and academic links.
-- Row-level security still limits these operations to authorized course owners/admins.
grant insert (course_code, department_id, semester_id) on public.courses to authenticated;
grant update (course_code, instructor_id) on public.courses to authenticated;
