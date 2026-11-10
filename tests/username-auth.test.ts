import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const login = readFileSync(resolve(process.cwd(), 'components/login-form.tsx'), 'utf8');
const loginRoute = readFileSync(resolve(process.cwd(), 'app/api/auth/username-login/route.ts'), 'utf8');
const signupRoute = readFileSync(resolve(process.cwd(), 'app/api/auth/username-signup/route.ts'), 'utf8');
const identity = readFileSync(resolve(process.cwd(), 'lib/auth/username-identity.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261110050000_coursepulse_username_auth.sql'), 'utf8');

describe('username and password authentication without email collection', () => {
  it('shows only username and password on sign-in and signup', () => {
    expect(login).toContain('Sign in with your username and password.');
    expect(login).toContain('No Gmail, email address or phone number needed.');
    expect(login).toContain("mode === 'signin' ? 'Username' : 'Choose username'");
    expect(login).toContain("mode === 'signup' && <label>Full name");
    expect(login).not.toContain('Email address');
    expect(login).not.toContain('Email for verification');
    expect(login).not.toContain('resetPasswordForEmail');
    expect(login).not.toContain('createClient');
  });

  it('creates a server-side confirmed Student account with a reserved internal identity', () => {
    expect(signupRoute).toContain('admin.auth.admin.createUser({');
    expect(signupRoute).toContain('email: authEmail');
    expect(signupRoute).toContain('email_confirm: true');
    expect(signupRoute).toContain('user_metadata: { full_name: fullName, username }');
    expect(signupRoute).toContain("profile.role !== 'STUDENT'");
    expect(signupRoute).toContain("admin.rpc('consume_username_login_rate_limit'");
    expect(signupRoute).toContain('isAllowedOrigin(request)');
    expect(signupRoute).toContain('return NextResponse.json({ success: true }');
    expect(signupRoute).not.toContain('email: parsed.data');
    expect(identity).toContain("accounts.coursepulse.invalid");
  });

  it('resolves usernames to private Auth identities without returning them to the browser', () => {
    expect(loginRoute).toContain(".select('email,is_active')");
    expect(loginRoute).toContain(".eq('username', username)");
    expect(loginRoute).toContain('supabase.auth.signInWithPassword({');
    expect(loginRoute).toContain('profile!.email || usernameToAuthEmail(username)');
    expect(loginRoute).toContain('return authFailure()');
    expect(loginRoute).toContain("'Cache-Control': 'no-store'");
    expect(loginRoute).toContain("createHmac('sha256', secret)");
  });

  it('applies independent signup and login rate limits and fails closed', () => {
    expect(signupRoute).toContain('usernameHash');
    expect(signupRoute).toContain('usernameAddressHash');
    expect(signupRoute).toContain('addressHash');
    expect(signupRoute).toContain('p_limit: 5');
    expect(signupRoute).toContain('p_limit: 20');
    expect(signupRoute).toContain('if (usernameLimit.error || usernameAddressLimit.error || addressLimit.error)');
    expect(loginRoute).toContain('p_limit: 20');
    expect(loginRoute).toContain('p_limit: 8');
    expect(loginRoute).toContain('p_limit: 40');
    expect(loginRoute).toContain('if (usernameLimit.error || usernameAddressLimit.error || addressLimit.error)');
  });

  it('keeps the private identity out of public profiles and preserves protected username rules', () => {
    expect(migration).toContain("split_part(lower(coalesce(new.email, '')), '@', 2) = 'accounts.coursepulse.invalid'");
    expect(migration).toContain('then null');
    expect(migration).toContain('grant update (username) on public.users to authenticated');
    expect(migration).toContain('row_number() over (partition by base_name order by id)');
    expect(migration).toContain('create trigger zz_auth_users_sync_coursepulse_username');
    expect(migration).toContain('revoke all on private.username_login_rate_limits from public, anon, authenticated, service_role');
    expect(migration).toContain('to service_role');
    expect(migration).not.toMatch(/grant select on public\\.users to anon/i);
  });
});
