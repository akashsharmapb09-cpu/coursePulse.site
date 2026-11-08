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
    RETURN;
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
    RETURN;
  END IF;

  -- Return normally so failed attempts commit the rate-limit increment.
  IF NOT private.consume_api_rate_limit('admin-signup:claim', 5, 900) THEN
    RETURN;
  END IF;

  IF p_code IS NULL OR length(p_code) < 1 OR length(p_code) > 256 THEN
    RETURN;
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
    RETURN;
  END IF;

  UPDATE public.users
  SET role = 'ADMIN'::public.app_role, updated_at = now()
  WHERE id = v_user_id AND role = 'STUDENT'::public.app_role;

  IF NOT FOUND THEN
    RETURN;
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
