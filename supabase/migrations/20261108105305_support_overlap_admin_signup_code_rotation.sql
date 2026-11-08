ALTER TABLE private.admin_signup_settings
  ADD COLUMN IF NOT EXISTS previous_code_sha256 bytea;

CREATE OR REPLACE FUNCTION private.claim_admin_signup(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_code_valid boolean;
  v_identity_verified boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  SELECT (
    u.confirmed_at IS NOT NULL
    OR u.email_confirmed_at IS NOT NULL
    OR u.phone_confirmed_at IS NOT NULL
  )
  INTO v_identity_verified
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF coalesce(v_identity_verified, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Verify your email or mobile number before activating Admin'
      USING errcode = '42501';
  END IF;

  IF NOT private.consume_api_rate_limit('admin-signup:claim', 5, 900) THEN
    RAISE EXCEPTION 'Too many administrator signup attempts. Try again later.'
      USING errcode = 'P0001';
  END IF;

  IF p_code IS NULL OR length(p_code) < 1 OR length(p_code) > 256 THEN
    RAISE EXCEPTION 'Invalid administrator signup code' USING errcode = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM private.admin_signup_settings s
    WHERE s.singleton = true
      AND (
        extensions.digest(p_code, 'sha256') = s.code_sha256
        OR extensions.digest(p_code, 'sha256') = s.previous_code_sha256
      )
  )
  INTO v_code_valid;

  IF NOT coalesce(v_code_valid, false) THEN
    RAISE EXCEPTION 'Invalid administrator signup code' USING errcode = '42501';
  END IF;

  UPDATE public.users
  SET role = 'ADMIN'::public.app_role, updated_at = now()
  WHERE id = v_user_id AND role = 'STUDENT'::public.app_role;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This account cannot be promoted to administrator'
      USING errcode = '42501';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                            || jsonb_build_object('role', 'ADMIN'),
      updated_at = now()
  WHERE id = v_user_id;
END;
$function$;
