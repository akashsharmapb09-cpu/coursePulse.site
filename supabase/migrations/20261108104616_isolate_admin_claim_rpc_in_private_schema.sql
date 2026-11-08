CREATE OR REPLACE FUNCTION private.claim_admin_signup(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_expected_hash bytea;
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

  SELECT s.code_sha256
  INTO v_expected_hash
  FROM private.admin_signup_settings s
  WHERE s.singleton = true;

  IF v_expected_hash IS NULL
    OR extensions.digest(p_code, 'sha256') IS DISTINCT FROM v_expected_hash THEN
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

REVOKE ALL ON FUNCTION private.claim_admin_signup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.claim_admin_signup(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_admin_signup(p_code text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.claim_admin_signup(p_code);
$function$;

REVOKE ALL ON FUNCTION public.claim_admin_signup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_signup(text) TO authenticated;
