import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const home = read('app/page.tsx');
const signup = read('app/signup/page.tsx');
const login = read('app/login/page.tsx');
const authForm = read('components/student-auth-form.tsx');
const authFunction = read('supabase/functions/student-username-auth/index.ts');
const authMigration = read('supabase/migrations/20261126075821_student_username_auth.sql');
const authRestrictionMigration = read('supabase/migrations/20261126081443_restrict_public_auth_to_student_usernames.sql');
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
const thankYou = read('app/feedback/thank-you/page.tsx');

describe('CoursePulse email-free student account experience', () => {
  it('confirms server-side anonymous feedback storage on the thank-you page', () => {
    expect(thankYou).toContain('Your anonymous response has been securely saved.');
    expect(thankYou).toContain('stored separately from your student account');
    expect(thankYou).not.toContain('in this browser');
  });
  it('offers student registration and sign-in from the homepage', () => {
    expect(home).toContain('href="/signup"');
    expect(home).toContain('href="/login"');
    expect(home).toContain('Create student account');
    expect(home).toContain('Student / Teacher sign in');
    expect(home).toContain('B.Tech');
    expect(home).toContain('B.Com');
    expect(home).toContain('username');
    expect(home).not.toContain('using their name, email');
    expect(home).not.toContain('Admin signup');
    expect(home).not.toContain('HOD signup');
  });

  it('renders dedicated student sign-up and sign-in pages', () => {
    expect(signup).toContain('<StudentAuthForm mode="signup"/>');
    expect(login).toContain('<StudentAuthForm mode="signin"/>');
    expect(signup).toContain("title: 'Create student account'");
    expect(login).toContain("title: 'Student & Teacher sign in'");
    expect(login).toContain('Teachers sign in with their college email and password.');
  });

  it('collects name, programme, username and a confirmed strong password only', () => {
    expect(authForm).toContain("full_name: fullName.trim()");
    expect(authForm).toContain('program: chosenProgramme');
    expect(authForm).toContain("action: 'register'");
    expect(authForm).toContain("action: 'login'");
    expect(authForm).toContain("supabase.functions.invoke('student-username-auth'");
    expect(authForm).toContain('supabase.auth.setSession');
    expect(authForm).toContain('Confirm password');
    expect(authForm).toContain('password !== confirmPassword');
    expect(authForm).toContain('At least 10 characters');
    expect(authForm).toContain('Username');
    expect(authForm).not.toContain('Email address');
    expect(authForm).not.toContain('type="email"');
    expect(authForm).not.toContain('supabase.auth.signUp');
    expect(authForm).toContain('signInWithPassword');
    expect(authForm).toContain('teacherEmailSignIn');
    expect(authForm).toContain("teacherProfile.role !== 'INSTRUCTOR'");
    expect(authForm).not.toContain("['INSTRUCTOR','ADMIN']");
    expect(authForm).not.toMatch(/requested_role|role:\s*['"](?:INSTRUCTOR|ADMIN)/);
    for (const item of ['B.Tech', 'M.Tech', 'BBA', 'B.Com', 'BCA', 'MBA', 'Other']) expect(authForm).toContain(item);
    expect(authForm).not.toContain('HOD sign-up');
  });

  it('allows the Netlify production app and deploy previews to call student username auth', () => {
    expect(authFunction).toContain('https://coursepulse.netlify.app');
    expect(authFunction).toContain('legacyProductionOrigin');
    expect(authFunction).toContain('netlifyPreviewOrigin.test(origin)');
    expect(authFunction).toContain('vercelPreviewOrigin.test(origin)');
  });

  it('creates immediately confirmed internal accounts without sending email', () => {
    expect(authFunction).toContain('admin.auth.admin.createUser');
    expect(authFunction).toContain('email_confirm: true');
    expect(authFunction).toContain('@students.coursepulse.invalid');
    expect(authFunction).toContain('consume_student_auth_attempt');
    expect(authFunction).toContain('admin.auth.admin.deleteUser');
    expect(authFunction).toContain('authClient.auth.signInWithPassword');
    expect(authFunction).toContain('login:user:');
    expect(authFunction).toContain('trustedCloudflareIp');
    expect(authRestrictionMigration).toContain('if not v_is_internal_username then');
    expect(authRestrictionMigration).toContain('values (\n    new.id,\n    null,');
    expect(authMigration).toContain('users_username_unique');
    expect(authMigration).toContain('private.student_auth_rate_limits');
    expect(authMigration).toContain('grant execute on function public.consume_student_auth_attempt');
    expect(prisma).toContain('username  String?');
  });

  it('keeps role assignment server-side and refreshes Supabase sessions', () => {
    expect(middleware).toContain('createServerClient');
    expect(middleware).toContain('supabase.auth.getUser()');
    expect(middleware).not.toContain("pathname === '/login'");
    expect(middleware).not.toContain("pathname === '/signup'");
    expect(middleware).toContain('admin|super-admin|verify');
    expect(middleware).toContain('buildContentSecurityPolicy');
    expect(middleware).not.toContain('status: 410');
    expect(middleware).toContain('/dashboard');
    expect(middleware).toContain('!user');
    expect(dashboard).toContain("from '@/components/dashboard'");
    expect(accountControl).toContain("select('full_name,username,program,role,is_active')");
    expect(accountControl).toContain("profile.role !== 'STUDENT'");
    expect(accountControl).toContain('@{account.username}');
  });

  it('shows the signed-in student name, username and programme with sign-out', () => {
    expect(accountControl).toContain('username: profile.username');
    expect(accountControl).toContain('Sign out');
    expect(publicSite).not.toContain('<StudentAccountControl/>');
    expect(workspace).toContain('<StudentAccountControl />');
  });

  it('keeps feedback anonymous and separate from the student account profile', () => {
    expect(workspace).toContain('coursepulse-college-demo-responses-v1');
    expect(workspace).toContain('window.localStorage');
    expect(workspace).toContain('Submit feedback');
    expect(workspace).toContain('Export CSV');
    expect(workspace).toContain('not linked to your student account');
    expect(dashboard).toContain('<Dashboard profile={{');
    expect(dashboard).toContain('supabase.auth.getUser()');
    expect(dashboard).not.toContain('<PublicWorkspace />');
    expect(workspace).not.toContain('supabase.from');
  });

  it('updates project, features, privacy, cookie and terms information', () => {
    expect(about).toContain('choose a unique username');
    expect(features).toContain('Student-only accounts');
    expect(features).toContain('username, password and programme');
    expect(privacy).toContain('full name, username, selected programme');
    expect(privacy).toContain('No email address or phone number is requested');
    expect(privacy).toContain('non-deliverable internal identifier');
    expect(privacy).toContain('There is no email-based password recovery');
    expect(cookies).toContain('Essential sign-in cookies');
    expect(cookies).toContain('student sign-in session');
    expect(terms).toContain('username, password and programme');
    expect(terms).toContain('No email address or verification message is needed');
    expect(publicSite).toContain('Create account');
    expect(publicSite).toContain('Student / Teacher sign in');
    expect(consent).toContain('essential first-party session cookies');
    expect(consent).toContain('only after you opt in');
  });
});
