import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/invite-college-users/index.ts'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/admin/roster/invitations/route.ts'), 'utf8');
const headRoster = readFileSync(resolve(process.cwd(), 'app/api/admin/roster/route.ts'), 'utf8');
const teacherRoster = readFileSync(resolve(process.cwd(), 'app/api/teacher/roster/route.ts'), 'utf8');
const teacherInvite = readFileSync(resolve(process.cwd(), 'app/api/teacher/roster/invitations/route.ts'), 'utf8');
const teacherUi = readFileSync(resolve(process.cwd(), 'components/teacher-roster.tsx'), 'utf8');
const functionSql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108165944_coursepulse_existing_account_roster_linking.sql'), 'utf8');

describe('secure student/teacher roster provisioning', () => {
  it('requires a verified signed-in Head with AAL2 and active organization scope', () => {
    expect(edge).toContain('admin.auth.getUser(accessToken)');
    expect(edge).toContain('const isHead = profile.role === "ADMIN" && claims.aal === "aal2"');
    expect(edge).toContain('const isTeacher = profile.role === "INSTRUCTOR"');
    expect(edge).toContain('if (!isHead && !isTeacher)');
    expect(edge).toContain('organization.status !== "ACTIVE"');
    expect(edge).toContain('.eq("organization_id", profile.organization_id)');
  });

  it('does not accept caller-supplied roles beyond student and instructor', () => {
    expect(edge).toContain('role !== "STUDENT" && role !== "INSTRUCTOR"');
    expect(edge).toContain('organization_invitations');
    expect(edge).toContain('inviteUserByEmail');
    expect(edge).not.toContain('createUser({');
  });

  it('links existing accounts only after verification and rejects accounts bound to another college', () => {
    expect(functionSql).toContain('Existing account must verify its email or phone');
    expect(functionSql).toContain('v_profile.organization_id is not null');
    expect(functionSql).toContain('This account already belongs to another college');
  });

  it('keeps teacher roster access assignment-scoped and does not return mobile or feedback answers', () => {
    expect(teacherRoster).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(teacherRoster).toContain("rpc('get_instructor_students'");
    expect(teacherRoster).toContain('course_id');
    expect(teacherRoster).not.toContain('mobile');
    expect(teacherRoster).not.toContain('answers');
  });

  it('keeps Head-only roster reads behind a database MFA gate', () => {
    expect(headRoster).toContain("rpc('get_head_student_roster'");
    expect(route).toContain('getCurrentUser');
    expect(route).toContain('admin:user-update');
  });

  it('lets instructors bulk-import students only to assigned classes, never create teacher accounts', () => {
    expect(edge).toContain('const isTeacher = profile.role === "INSTRUCTOR"');
    expect(edge).toContain('Teachers can invite students only.');
    expect(edge).toContain('assignedCourseIds.has(courseId)');
    expect(teacherInvite).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(teacherInvite).toContain("role: 'STUDENT'");
    expect(teacherUi).not.toContain("fetch('/api/teacher/roster/invitations'");

    expect(teacherUi).toContain("fetch('/api/teacher/roster/import'");
    expect(teacherUi).not.toContain('Add one student manually');
    expect(teacherUi).not.toContain('Add student & send invite');
  });
});
