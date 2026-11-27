import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiAuth = readFileSync(resolve(process.cwd(), 'lib/http.ts'), 'utf8');
const dashboard = readFileSync(resolve(process.cwd(), 'app/dashboard/page.tsx'), 'utf8');
const authForm = readFileSync(resolve(process.cwd(), 'components/student-auth-form.tsx'), 'utf8');
const signup = readFileSync(resolve(process.cwd(), 'app/signup/page.tsx'), 'utf8');
const about = readFileSync(resolve(process.cwd(), 'app/about/page.tsx'), 'utf8');
const contact = readFileSync(resolve(process.cwd(), 'app/contact/page.tsx'), 'utf8');

describe('public CoursePulse role model', () => {
  it('allows application API sessions only for Students and Teachers', () => {
    expect(apiAuth).toContain("profile.role !== 'STUDENT' && profile.role !== 'INSTRUCTOR'");
    expect(apiAuth).not.toContain("profile.role === 'ADMIN'");
  });

  it('does not route Admin profiles into a user-facing dashboard', () => {
    expect(dashboard).toContain("profile.role !== 'STUDENT' && profile.role !== 'INSTRUCTOR'");
    expect(dashboard).toContain("redirect('/login?reason=role-unavailable')");
    expect(dashboard).not.toContain('AdminMfaGate');
  });

  it('allows email sign-in only for active Teacher profiles', () => {
    expect(authForm).toContain("teacherProfile.role !== 'INSTRUCTOR'");
    expect(authForm).toContain("teacherProfile?.is_active");
    expect(authForm).not.toContain("['INSTRUCTOR','ADMIN']");
  });

  it('keeps public signup and information pages on the Student / Teacher role model', () => {
    expect(signup).toContain('Teacher access is provided by invitation.');
    expect(signup).not.toMatch(/HOD|Admin/i);
    expect(about).toContain('Teacher access is provided through invitation.');
    expect(about).not.toMatch(/HOD|Admin/i);
    expect(contact).toContain('your assigned Teacher or department office');
    expect(contact).not.toMatch(/HOD|Admin/i);
  });
});
