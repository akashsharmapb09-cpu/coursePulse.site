-- Retire CoursePulse Digital Student ID and QR verification.
-- Preserve public.student_directory, roll numbers, enrollments, and roster workflows.
-- If any unexpired or historical QR tokens remain, abort so they can be reviewed first.
DO $migration$
DECLARE
  v_rows bigint;
BEGIN
  LOCK TABLE private.student_id_qr_tokens IN ACCESS EXCLUSIVE MODE;
  SELECT count(*) INTO v_rows FROM private.student_id_qr_tokens;

  IF v_rows > 0 THEN
    RAISE EXCEPTION
      'Refusing to remove Digital ID: % QR token row(s) remain in private.student_id_qr_tokens.',
      v_rows;
  END IF;
END
$migration$;

DROP FUNCTION IF EXISTS public.register_student_card_token(text);
DROP FUNCTION IF EXISTS public.verify_student_card(text);
DROP TABLE private.student_id_qr_tokens;
DROP FUNCTION IF EXISTS private.register_student_card_token(text);
DROP FUNCTION IF EXISTS private.verify_student_card(text);
