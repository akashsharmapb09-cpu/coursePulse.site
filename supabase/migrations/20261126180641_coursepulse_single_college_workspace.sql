-- Retire multi-college SaaS controls while keeping one internal workspace for RLS.
-- Existing users, courses, feedback, enrollments, rosters and anonymous answers are preserved.

DO $$
DECLARE
  v_workspace_id uuid;
  v_workspace_count integer;
BEGIN
  SELECT count(*) INTO v_workspace_count FROM public.organizations;
  IF v_workspace_count <> 1 THEN
    RAISE EXCEPTION 'Single-college cutover requires exactly one existing workspace; found %', v_workspace_count;
  END IF;

  SELECT id INTO v_workspace_id
  FROM public.organizations
  WHERE status = 'ACTIVE';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'The sole CoursePulse workspace must be ACTIVE before the single-college cutover';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE organization_id IS NOT NULL AND organization_id <> v_workspace_id
  ) THEN
    RAISE EXCEPTION 'A user profile references a different workspace; refusing to reassign account ownership';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_invitations
    WHERE invited_role = 'ADMIN'::public.app_role
  ) THEN
    RAISE EXCEPTION 'An HOD invitation exists; review it before retiring college provisioning';
  END IF;

  -- Attach only NULL Student profiles to the sole workspace. Never move a user
  -- who already belongs to a different workspace.
  UPDATE public.users
  SET organization_id = v_workspace_id
  WHERE organization_id IS NULL;
END
$$;

-- A constant-expression unique index permits only one organization row.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_single_workspace_only_idx
  ON public.organizations ((true));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_single_workspace_active_check
  CHECK (status = 'ACTIVE');

-- The local HOD can invite Students and Teachers, not additional HODs.
ALTER TABLE public.organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_invited_role_check;
ALTER TABLE public.organization_invitations
  ADD CONSTRAINT organization_invitations_invited_role_check
  CHECK (invited_role IN ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role));

-- Retire "first HOD verifies email to activate a new college".
DROP TRIGGER IF EXISTS auth_activate_college_after_verification ON auth.users;
DROP FUNCTION IF EXISTS public.activate_college_workspace_after_auth_verification();

-- Remove platform-only policies before removing their authorization helpers.
DROP POLICY IF EXISTS organizations_platform_insert ON public.organizations;
DROP POLICY IF EXISTS organizations_platform_update ON public.organizations;
DROP POLICY IF EXISTS organizations_current_read ON public.organizations;
DROP POLICY IF EXISTS platform_admin_audit_platform_only ON private.platform_admin_audit;

-- Drop public wrappers before their private implementations.
DROP FUNCTION IF EXISTS public.platform_list_organizations();
DROP FUNCTION IF EXISTS public.platform_list_organization_heads();
DROP FUNCTION IF EXISTS public.platform_get_summary();
DROP FUNCTION IF EXISTS public.platform_update_organization(uuid, text, text);
DROP FUNCTION IF EXISTS public.platform_remove_organization(uuid);
DROP FUNCTION IF EXISTS public.platform_remove_organization_head(uuid);
DROP FUNCTION IF EXISTS public.platform_is_admin();
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.platform_record_college_invitation_audit(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.accept_existing_college_head_invitation(uuid);
DROP FUNCTION IF EXISTS public.update_current_organization(text, text);

-- Retire legacy, already-revoked workspace/HOD claim RPCs as well.
DROP FUNCTION IF EXISTS public.admin_claim_setup_workspace(text);
DROP FUNCTION IF EXISTS public.claim_admin_signup(text);
DROP FUNCTION IF EXISTS private.claim_setup_workspace(text);
DROP FUNCTION IF EXISTS private.claim_admin_signup(text);

DROP FUNCTION IF EXISTS private.platform_list_organizations();
DROP FUNCTION IF EXISTS private.platform_list_organization_heads();
DROP FUNCTION IF EXISTS private.platform_get_summary();
DROP FUNCTION IF EXISTS private.platform_update_organization(uuid, text, text);
DROP FUNCTION IF EXISTS private.platform_remove_organization(uuid);
DROP FUNCTION IF EXISTS private.platform_remove_organization_head(uuid);
DROP FUNCTION IF EXISTS private.platform_is_admin();
DROP FUNCTION IF EXISTS private.is_platform_admin();
DROP FUNCTION IF EXISTS private.update_current_organization(text, text);

-- Preserve historical platform membership/audit evidence but make it inert and
-- inaccessible to application/service roles. Do not delete the historical rows.
ALTER TABLE private.platform_admins RENAME TO retired_platform_admins;
ALTER TABLE private.platform_admin_audit RENAME TO retired_platform_admin_audit;
REVOKE ALL ON TABLE private.retired_platform_admins FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private.retired_platform_admin_audit FROM PUBLIC, anon, authenticated, service_role;

-- Remove SaaS-only metadata. Keep workspace ID/name/status for RLS and reports.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_slug_key;
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS owner_user_id,
  DROP COLUMN IF EXISTS subscription_status;

-- Authenticated users may read only the one workspace associated with their profile.
CREATE POLICY organizations_current_read
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id = private.current_organization_id());

-- No application role or Edge Function can create, rename, suspend or delete
-- the single workspace. Service role retains SELECT for the Student/Teacher invite flow.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.organizations
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE SELECT ON TABLE public.organizations FROM anon, PUBLIC;
GRANT SELECT ON TABLE public.organizations TO authenticated, service_role;

-- Every new Student/Teacher auth profile automatically inherits the sole
-- workspace before the users.organization_id NOT NULL check is evaluated.
CREATE OR REPLACE FUNCTION private.assign_single_workspace_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT id INTO v_workspace_id
  FROM public.organizations
  WHERE status = 'ACTIVE';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'CoursePulse workspace is unavailable' USING ERRCODE = '23514';
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_workspace_id;
  ELSIF NEW.organization_id <> v_workspace_id THEN
    RAISE EXCEPTION 'This CoursePulse deployment supports one college workspace only' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_single_workspace_to_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS users_assign_single_workspace ON public.users;
CREATE TRIGGER users_assign_single_workspace
  BEFORE INSERT OR UPDATE OF organization_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_single_workspace_to_user();

ALTER TABLE public.users
  ALTER COLUMN organization_id SET NOT NULL;
