import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const home = read('app/page.tsx');
const signup = read('app/signup/page.tsx');
const login = read('app/login/page.tsx');
const authForm = read('components/student-auth-form.tsx');
const accountControl = read('components/student-account-control.tsx');
const dashboard = read('app/dashboard/page.tsx');
const workspace = read('components/public-workspace.tsx');
const middleware = read('middleware.ts');
const about = read('app/about/page.tsx');
const features = read('app/features/page.tsx');
const privacy = read('app/privacy/page.tsx');
const cookies = read('app/cookies/page.tsx');
const publicSite = read('components/public-site.tsx');
const consent = read('components/cookie-consent.tsx');
const terms = read('app/terms/page.tsx');
const prisma = read('prisma/schema.prisma');

describe('CoursePulse student account experience', () => {
  it('offers student registration and sign-in from the homepage', () => {
    expect(home).toContain('href="/signup"');
    expect(home).toContain('href="/login"');
    expect(home).toContain('Create student account');
    expect(home).toContain('Student sign in');
    expect(home).toContain('B.Tech');
    expect(home).toContain('B.Com');
    expect(home).not.toContain('Admin signup');
    expect(home).not.toContain('HOD signup');
  });

  it('renders dedicated student sign-up and sign-in pages', () => {
    expect(signup).toContain('<StudentAuthForm mode="signup"/>');
    expect(login).toContain('<StudentAuthForm mode="signin"/>');
    expect(signup).toContain("title: 'Create student account'");
    expect(login).toContain("title: 'Student sign in'");
  });

  it('collects name, programme, email and a confirmed strong password', () => {
    expect(authForm).toContain('full_name: fullName.trim()');
    expect(authForm).toContain('program: chosenProgramme');
    expect(authForm).toContain('supabase.auth.signUp');
    expect(authForm).toContain('supabase.auth.signInWithPassword');
    for (const item of ['B.Tech', 'M.Tech', 'BBA', 'B.Com', 'BCA', 'MBA', 'Other']) expect(authForm).toContain(item);
    expect(authForm).toContain('Confirm password');
    expect(authForm).toContain('password !== confirmPassword');
    expect(authForm).toContain('At least 10 characters');
    expect(authForm).toContain("profile?.role !== 'STUDENT'");
    expect(authForm).not.toContain('requested_role');
    expect(authForm).not.toContain('ADMIN');
    expect(authForm).toContain('does not offer Admin or HOD sign-up');
  });

  it('keeps role assignment server-side and refreshes Supabase sessions', () => {
    expect(middleware).toContain('createServerClient');
    expect(middleware).toContain('supabase.auth.getUser()');
    expect(middleware).not.toContain("pathname === '/login'");
    expect(middleware).not.toContain("pathname === '/signup'");
    expect(middleware).toContain('admin|super-admin|verify');
    expect(middleware).toContain('buildContentSecurityPolicy');
    expect(middleware).toContain('status: 410');
    expect(accountControl).toContain("profile.role !== 'STUDENT'");
    expect(prisma).toContain('program   String?');
  });

  it('shows a signed-in student name and programme with sign-out', () => {
    expect(accountControl).toContain("select('full_name,program,role,is_active')");
    expect(accountControl).toContain('Sign out');
    expect(publicSite).toContain('<StudentAccountControl/>');
    expect(workspace).toContain('<StudentAccountControl />');
  });

  it('keeps feedback anonymous and separate from the student account profile', () => {
    expect(workspace).toContain('coursepulse-college-demo-responses-v1');
    expect(workspace).toContain('window.localStorage');
    expect(workspace).toContain('Submit feedback');
    expect(workspace).toContain('Export CSV');
    expect(workspace).toContain('not linked to your student account');
    expect(dashboard).toContain('<PublicWorkspace />');
    expect(workspace).not.toContain('supabase.from');
  });

  it('updates project, features, privacy, cookies and terms information', () => {
    expect(about).toContain('B.Tech, M.Tech, BBA, B.Com');
    expect(about).toContain('New self-registrations receive Student access only');
    expect(features).toContain('Student-only accounts');
    expect(privacy).toContain('full name, email address, selected programme');
    expect(privacy).toContain('Supabase Authentication handles the password');
    expect(privacy).toContain('does not add your account name or email to those responses');
    expect(cookies).toContain('Essential sign-in cookies');
    expect(cookies).toContain('student sign-in session');
    expect(terms).toContain('New public registrations are assigned Student access');
    expect(publicSite).toContain('Create account');
    expect(publicSite).toContain('Student sign in');
    expect(consent).toContain('essential first-party session cookies');
    expect(consent).toContain('only after you opt in');
  });
});