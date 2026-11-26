-- Preserve completed pre-upgrade submissions in the new course-level tracker.
-- The previous private eligibility table keeps student/course-form linkage
-- separately from the anonymous answer table, so it is the only safe source
-- for this one-time backfill.
insert into private.submission_tracker (
  student_id, course_id, organization_id, submitted_at
)
select
  eligibility.student_id,
  feedback.course_id,
  eligibility.organization_id,
  now()
from private.feedback_eligibility eligibility
join public.feedback feedback
  on feedback.id = eligibility.feedback_id
 and feedback.organization_id = eligibility.organization_id
where eligibility.consumed = true
group by
  eligibility.student_id,
  feedback.course_id,
  eligibility.organization_id
on conflict (student_id, course_id) do nothing;
