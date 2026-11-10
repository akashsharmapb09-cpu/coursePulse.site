import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const login = readFileSync(resolve(process.cwd(), 'components/login-form.tsx'), 'utf8');
const loginRoute = readFileSync(resolve(process.cwd(), 'app/api/auth/username-login/route.ts'), 'utf8');
const signupRoute = readFileSync(resolve(process.cwd(), 'app/api/auth/username-signup/route.ts'), 'utf8');
const identity = readFileSync(resolve(process.cwd(), 'lib/auth/username-identity.ts'), 'utf8');

describe('authentication response privacy', () => {
  it('uses the same public sign-in failure for unknown usernames and incorrect passwords', () => {
    expect(loginRoute).toContain('Sign-in failed. Check your username and password and try again.');
    expect(login).toContain("data.error || (mode === 'signin' ? 'Sign-in failed.'");
    expect(loginRoute).toContain('const dummyEmail =');
    expect(loginRoute).not.toContain('return NextResponse.json({ email:');
    expect(loginRoute).toContain("'Cache-Control': 'no-store'");
  });

  it('does not collect or return a real email address during public signup', () => {
    expect(login).not.toContain('Email address');
    expect(login).not.toContain('Email for verification');
    expect(signupRoute).toContain("email_confirm: true");
    expect(signupRoute).toContain("return NextResponse.json({ success: true }");
    expect(signupRoute).not.toContain('return NextResponse.json({ email:');
    expect(signupRoute).toContain('usernameToAuthEmail(username)');
    expect(identity).toContain('accounts.coursepulse.invalid');
  });

  it('clearly explains administrator-only recovery for accounts without an email', () => {
    expect(login).toContain('a forgotten password must be reset by your college administrator');
    expect(login).toContain('contact your college administrator for a reset');
    expect(login).not.toContain('resetPasswordForEmail');
  });
});
