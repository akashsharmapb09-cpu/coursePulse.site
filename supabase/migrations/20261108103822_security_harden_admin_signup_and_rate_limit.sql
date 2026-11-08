-- Allow separate server-route and direct-RPC administrator signup counters.
ALTER TABLE private.api_rate_limits
  DROP CONSTRAINT IF EXISTS api_rate_limits_action_check;

ALTER TABLE private.api_rate_limits
  ADD CONSTRAINT api_rate_limits_action_check
  CHECK (action IN (
    'courses:create',
    'feedback:create',
    'responses:submit',
    'admin:user-update',
    'admin-signup:route',
    'admin-signup:claim',
    'account:password-change',
    'account:profile-update',
    'account:deletion-request',
    'search:query',
    'analytics:query',
    'exports:download'
  ));

CREATE OR REPLACE FUNCTION private.consume_api_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  IF p_action NOT IN (
    'courses:create',
    'feedback:create',
    'responses:submit',
    'admin:user-update',
    'admin-signup:route',
    'admin-signup:claim',
    'account:password-change',
    'account:profile-update',
    'account:deletion-request',
    'search:query',
    'analytics:query',
    'exports:download'
  ) OR p_limit < 1 OR p_limit > 100
    OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration' USING errcode = '22023';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO private.api_rate_limits(user_id, action, window_start, request_count)
  VALUES (v_user_id, p_action, v_window_start, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET request_count = private.api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$function$;

-- User metadata is mutable by the account holder; it never grants roles.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    left(coalesce(NEW.raw_user_meta_data ->> 'full_name', ''), 120),
    'STUDENT'::public.app_role
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                            - 'admin_signup_code'
                            - 'requested_role'
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- Enforce a per-user limit inside the RPC, including direct PostgREST calls.
CREATE OR REPLACE FUNCTION public.claim_admin_signup(p_code text)
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

REVOKE ALL ON FUNCTION public.claim_admin_signup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_signup(text) TO authenticated;
REVOKE ALL ON FUNCTION private.consume_api_rate_limit(text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.consume_api_rate_limit(text, integer, integer)
  TO authenticated;
