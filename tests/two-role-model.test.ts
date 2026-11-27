import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const migration = read('supabase/migrations/20261127190000_coursepulse_two_role_student_teacher_only.sql');
const authForm = read('components/student-auth-form.tsx');
const dashboardPage = read('app/dashboard/page.tsx');
const dashboard = read('components/dashboard.tsx');
const courses = read('app/api/courses/route.ts');
const feedback = read('app/api/feedback/route.ts');
const analytics = read('app/api/analytics/route.ts');
const exportsRoute = read('app/api/exports/[format]/route.ts');
const invite = read('supabase/functions/invite-college-users/index.ts');

describe('CoursePulse Student and Teacher role model', () => {
  it('converts legacy HOD/Admin profiles into Teachers without changing their user IDs', () => {
    expect(migration).toMatch(/UPDATE public\.users[\s\S]*?SET role = 'INSTRUCTOR'::public\.app_role[\s\S]*?WHERE role = 'ADMIN'::public\.app_role/i);
    expect(migration).toContain('updated_at = now()');
    expect(migration).toMatch(/users_two_role_only_check[\s\S]*?CHECK \(role IN \('STUDENT'::public\.app_role, 'INSTRUCTOR'::public\.app_role\)\)/i);
  });

  it('disables the legacy Admin/HOD authorization helper', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION private\.is_admin\(\)[\s\S]*?SELECT false/i);
  });

  it('keeps Student username registration and supports Teacher college-email self-registration', () => {
    expect(authForm).toContain("type SignupRole = 'student' | 'teacher'");
    expect(authForm).toContain("body: mode === 'signup'");
    expect(authForm).toContain("supabase.auth.signUp({");
    expect(authForm).toContain("requested_role: 'INSTRUCTOR'");
    expect(authForm).toContain("emailRedirectTo:");
    expect(authForm).toContain("supabase.functions.invoke('student-username-auth'");
    expect(migration).toContain("v_requested_role = 'INSTRUCTOR'");
    expect(migration).toContain("'INSTRUCTOR'::public.app_role");
  });

  it('allows only Students and Teachers into the authenticated dashboard', () => {
    expect(dashboardPage).toContain("if (!['STUDENT','INSTRUCTOR'].includes(profile.role)) redirect('/login');");
    expect(dashboardPage).not.toContain('AdminMfaGate');
    expect(dashboard).not.toContain('HOD console');
    expect(dashboard).toContain("const canTeach = profile.role === 'INSTRUCTOR'");
  });

  it('restricts course, feedback, analytics and exports to Teachers', () => {
    expect(courses).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(feedback).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(analytics).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(exportsRoute).toContain("auth.profile.role !== 'INSTRUCTOR'");
  });

  it('allows Teachers to invite Students only', () => {
    expect(invite).toContain('const isTeacher = profile.role === "INSTRUCTOR"');
    expect(invite).toContain('if (!isTeacher)');
    expect(invite).toContain('Teachers can invite students only.');
    expect(invite).not.toContain('const isHead');
  });
});
