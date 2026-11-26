-- Remove the separate identified Student Voice channel from CoursePulse.
-- The table is dropped only when it is empty; any submissions abort this migration.
DO $migration$
DECLARE
  v_rows bigint;
BEGIN
  LOCK TABLE public.student_suggestions IN ACCESS EXCLUSIVE MODE;
  SELECT count(*) INTO v_rows FROM public.student_suggestions;

  IF v_rows > 0 THEN
    RAISE EXCEPTION
      'Refusing to remove Student Voice: % suggestion(s) remain in public.student_suggestions. Export/archive them before retrying.',
      v_rows;
  END IF;

  DROP TABLE public.student_suggestions;
END
$migration$;

DROP FUNCTION IF EXISTS private.guard_student_suggestion_update();
