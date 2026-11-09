import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261109064700_coursepulse_four_role_hierarchy_and_platform_controls.sql'), 'utf8');
const foundation = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108163318_coursepulse_multi_college_tenant_foundation.sql'), 'utf8');
const accessControls = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108165428_coursepulse_organization_and_platform_admin_controls.sql'), 'utf8');
const adminApi = readFileSync(resolve(process.cwd(), 'app/api/admin/route.ts'), 'utf8');
const adminUsersApi = readFileSync(resolve(process.cwd(), 'app/api/admin/users/route.ts'), 'utf8');
const headInvite = readFileSync(resolve(process.cwd(), 'app/api/admin/roster/invitations/route.ts'), 'utf8');
const teacherInvite = readFileSync(resolve(process.cwd(), 'app/api/teacher/roster/invitations/route.ts'), 'utf8');
const rosterFunction = readFileSync(resolve(process.cwd(), 'supabase/functions/invite-college-users/index.ts'), 'utf8');
const hodConsole = readFileSync(resolve(process.cwd(), 'components/admin-console.tsx'), 'utf8');
const platformPage = readFileSync(resolve(process.cwd(), 'components/platform-admin-dashboard.tsx'), 'utf8');

describe('CoursePulse four-role authorization model', () => {
  it('keeps the four display roles mapped to existing database roles and a separate global Super Admin membership', () => {
    expect(foundation).toContain('private.platform_admins');
    expect(migration).toContain("p_role not in ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role)");
    expect(platformPage).toContain('Platform Super Admin');
    expect(hodConsole).toContain("user.role==='ADMIN'?'HOD'");
    expect(hodConsole).toContain("user.role==='INSTRUCTOR'?'Teacher':'Student'");
  });

  it('limits HOD account management to Student and Teacher activation/removal within the current college', () => {
    expect(migration).toContain('private.is_admin()');
    expect(migration).toContain("auth.jwt()->>'aal'");
    expect(migration).toContain('and organization_id = v_org');
    expect(migration).toContain("v_old_role not in ('STUDENT'::public.app_role, 'INSTRUCTOR'::public.app_role)");
    expect(migration).toContain('You cannot remove or change your own HOD access');
    expect(adminApi).toContain("z.enum(['INSTRUCTOR', 'STUDENT'])");
    expect(adminApi).not.toContain("z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])");
    expect(adminUsersApi).toContain("z.enum(['INSTRUCTOR','STUDENT'])");
    expect(hodConsole).not.toContain('<option value="ADMIN">ADMIN</option>');
    expect(hodConsole).toContain("user.role!=='ADMIN'");
  });

  it('allows HOD to invite Teacher and Student accounts, while Teacher invites Students only', () => {
    expect(headInvite).toContain("auth.profile.role !== 'ADMIN'");
    expect(headInvite).toContain("role: z.enum(['STUDENT', 'INSTRUCTOR'])");
    expect(rosterFunction).toContain('const isHead = profile.role === "ADMIN" && claims.aal === "aal2"');
    expect(rosterFunction).toContain('const isTeacher = profile.role === "INSTRUCTOR"');
    expect(rosterFunction).toContain('Teachers can invite students only.');
    expect(rosterFunction).toContain('assignedCourseIds.has(courseId)');
    expect(teacherInvite).toContain("role: 'STUDENT'");
  });

  it('preserves database-enforced college isolation and suspends a college without exposing its records', () => {
    expect(foundation).toContain("o.status='ACTIVE'");
    expect(foundation).toContain('private.current_organization_id()');
    expect(foundation).toContain('users_tenant_boundary');
    expect(migration).toContain("set status = 'SUSPENDED'");
    expect(migration).toContain("where status = 'ACTIVE'");
    expect(migration).toContain('organization.removed_from_active_platform');
  });

  it('removes account access without hard-deleting academic or feedback history', () => {
    expect(migration).toContain('set is_active = p_is_active');
    expect(migration).toContain('suspended_at = case');
    expect(migration).toContain('user.access.updated');
    expect(migration).toContain('HOD access is now exclusively');
    expect(accessControls).toContain('revoke insert,delete on public.users from authenticated');
    expect(foundation).toContain('ON DELETE RESTRICT');
    expect(hodConsole).toContain('Accounts are not hard-deleted');
    expect(hodConsole).toContain('preserved');
    expect(migration).not.toContain('delete from public.users');
    expect(migration).not.toContain('delete from public.organizations');
  });

  it('revokes the old self-claim HOD RPCs so only the Platform Super Admin invitation flow can appoint HODs', () => {
    expect(migration).toContain('revoke all on function private.claim_setup_workspace(text) from public, anon, authenticated');
    expect(migration).toContain('revoke all on function public.claim_admin_signup(text) from public, anon, authenticated');
    expect(migration).toContain('Platform Super Admin');
  });
});
