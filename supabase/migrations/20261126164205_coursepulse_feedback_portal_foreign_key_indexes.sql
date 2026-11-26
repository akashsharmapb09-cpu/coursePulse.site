-- Cover foreign-key lookups for the new question catalogue, private tracker,
-- and de-identified instructor response projection.
create index if not exists submission_tracker_course_id_idx
  on private.submission_tracker(course_id);
create index if not exists feedback_submissions_course_id_idx
  on public.feedback_submissions(course_id);
create index if not exists feedback_submissions_feedback_id_idx
  on public.feedback_submissions(feedback_id);
create index if not exists questions_course_id_idx
  on public.questions(course_id);
create index if not exists questions_feedback_id_idx
  on public.questions(feedback_id);
create index if not exists questions_created_by_idx
  on public.questions(created_by);
