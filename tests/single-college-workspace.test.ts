import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = readFileSync(resolve(root, 'supabase/migrations/20261126183102_coursepulse_single_college_workspace.sql'), 'utf8');
const twoRoleMigration = readFileSync(resolve(root, 'supabase/migrations/20261127190000_coursepulse_two_role_student_teacher_only.sql'), 'utf8');
const dashboard = readFileSync(resolve(root, 'components/dashboard.tsx'), 'utf8');
const loginPage = readFileSync(resolve(root, 'app/login/page.tsx'), 'utf8');
const authForm = readFileSync(resolve(root, 'components/student-auth-form.tsx'), 'utf8');
const teacherInviteRoute = readFileSync(resolve(root, 'app/api/admin/roster/invitations/route.ts'), 'utf8');
const teacherInviteFunction = readFileSync(resolve(root, 'supabase/functions/invite-college-users/index.ts'), 'utf8');
const publicHeader = readFileSync(resolve(root, 'components/public-site.tsx'), 'utf8');
const collegeProvisioner = readFileSync(resolve(root, 'supabase/functions/create-college-workspace/index.ts'), 'utf8');

describe('single-college CoursePulse deployment', () => {
  it('links unscoped legacy Student profiles to the sole workspace without moving users from another workspace', () => {
    expect(migration).toContain('SELECT count(*) INTO v_workspace_count FROM public.organizations');
    expect(migration).toContain('IF v_workspace_count <> 1 THEN');
    expect(migration).toContain('UPDATE public.users');
    expect(migration).toContain('WHERE organization_id IS NULL');
    expect(migration).toContain('organization_id <> v_workspace_id');
    expect(migration).toContain('ALTER COLUMN organization_id SET NOT NULL');
  });

  it('prevents creation of another college and fixes the only workspace as active', () => {
    expect(migration).toContain('organizations_single_workspace_only_idx');
    expect(migration).toContain('ON public.organizations ((true))');
    expect(migration).toContain('organizations_single_workspace_active_check');
    expect(migration).toContain("CHECK (status = 'ACTIVE')");
    expect(migration).toContain('assign_single_workspace_to_user');
    expect(migration).toContain('This CoursePulse deployment supports one college workspace only');
  });

  it('removes platform college provisioning and subscription metadata without deleting audit evidence', () => {
    expect(migration).toContain('DROP COLUMN IF EXISTS slug');
    expect(migration).toContain('DROP COLUMN IF EXISTS owner_user_id');
    expect(migration).toContain('DROP COLUMN IF EXISTS subscription_status');
    expect(migration).toContain('RENAME TO retired_platform_admins');
    expect(migration).toContain('RENAME TO retired_platform_admin_audit');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.platform_list_organizations()');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.accept_existing_college_head_invitation(uuid)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.admin_claim_setup_workspace(text)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.claim_admin_signup(text)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS private.claim_setup_workspace(text)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS private.claim_admin_signup(text)');
    expect(migration).toContain('DROP TRIGGER IF EXISTS auth_activate_college_after_verification ON auth.users');
    expect(migration).toContain("CHECK (invited_role IN ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role))");
    expect(collegeProvisioner).toContain('status: 410');
    expect(collegeProvisioner).toContain('Multi-college workspace provisioning is no longer supported');
  });

  it('removes the unused platform and college settings surfaces', () => {
    for (const path of [
      'app/super-admin/page.tsx',
      'components/platform-admin-dashboard.tsx',
      'components/organization-settings.tsx',
      'app/api/platform/organizations/route.ts',
      'app/api/platform/organizations/head/route.ts',
      'app/api/admin/organization/route.ts',
      'app/api/admin-signup/prepare/route.ts',
      'app/api/admin-signup/grant/route.ts',
      'app/api/admin-signup/clear/route.ts',
      'lib/admin-signup.ts'
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(false);
    }
    expect(dashboard).not.toContain('OrganizationSettings');
    expect(dashboard).not.toContain('PlatformAdminDashboard');
  });

  it('preserves Student signup and makes Teacher college-email sign-in visible', () => {
    expect(authForm).toContain('instructorEmailSignIn');
    expect(authForm).toContain("instructorProfile.role !== 'INSTRUCTOR'");
    expect(authForm).toContain("requested_role: 'INSTRUCTOR'");
    expect(twoRoleMigration).toContain("role IN ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role)");
    expect(twoRoleMigration).toContain('SELECT false');
    expect(loginPage).toContain('Student & Teacher sign in');
    expect(publicHeader).toContain('Student / Teacher sign in');
  });

  it('allows Teachers to invite Students only and exposes Teacher workspace tools', () => {
    expect(teacherInviteRoute).toContain("role: z.enum(['STUDENT', 'INSTRUCTOR'])");
    expect(teacherInviteFunction).toContain('const isTeacher = profile.role === "INSTRUCTOR"');
    expect(teacherInviteFunction).not.toContain('const isHead');
    expect(teacherInviteFunction).toContain('Teacher access is required.');
    expect(teacherInviteFunction).toContain('Teachers can invite students only.');
    expect(dashboard).toContain('TeacherInbox');
    expect(dashboard).toContain('TeacherRoster');
    expect(dashboard).toContain("profile.role==='INSTRUCTOR'");
    expect(dashboard).toContain('Analytics');
    expect(dashboard).not.toContain('OrganizationSettings');
  });
});
