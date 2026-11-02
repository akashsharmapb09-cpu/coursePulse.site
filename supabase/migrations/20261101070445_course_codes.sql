-- Optional institutional course codes; existing records remain unchanged.
alter table public.courses
  add column course_code text;

alter table public.courses
  add constraint courses_course_code_length
  check (course_code is null or char_length(btrim(course_code)) between 2 and 30);

create unique index courses_course_code_unique
  on public.courses (lower(course_code))
  where course_code is not null;
