-- Course codes belong to a college workspace, not to the whole CoursePulse platform.
-- This lets different colleges use common codes such as CSE101 without collisions.
drop index if exists public.courses_course_code_unique;

create unique index if not exists courses_org_course_code_unique
  on public.courses (organization_id, lower(course_code))
  where course_code is not null;

comment on index public.courses_org_course_code_unique is
  'Course codes are unique within each college workspace.';
