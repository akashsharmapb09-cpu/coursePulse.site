import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const login = readFileSync(resolve(process.cwd(), 'components/login-form.tsx'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/auth/username-login/route.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261110050000_coursepulse_username_auth.sql'), 'utf8');

describe('username and password authentication', () => {
  it('shows username rather than email or phone on the sign-in form', () => {
    expect(login).toContain('Sign in with your username and password.');
    expect(login).toContain('>Username<span');
    expect(login).not.toContain('signInWithPassword({ email: email.trim()');
    expect(login).toContain("mode === 'signin' && <label>Username");
    expect(login).not.toContain("mode === 'signin' && <label>Email address");
  });

  it('keeps email limited to signup verification and password recovery', () => {
    expect(login).toContain('Email for verification and recovery');
    expect(login).toContain('resetPasswordForEmail(email.trim()');
    expect(login).toContain('username: username.trim().toLowerCase()');
  });

  it('resolves the username on the server and never returns the Auth email', () => {
    expect(route).toContain(".select('email,is_active')");
    expect(route).toContain(".eq('username', username)");
    expect(route).toContain('supabase.auth.signInWithPassword({');
    expect(route).toContain('return authFailure()');
    expect(route).not.toContain('profile.email }');
    expect(route).toContain("'Cache-Control': 'no-store'");
  });

  it('applies same-origin validation and independent IP/username rate limits', () => {
    expect(route).toContain('isAllowedOrigin(request)');
    expect(route).toContain('usernameAddressHash');
    expect(route).toContain("createHmac('sha256', secret)");
    expect(route).not.toContain("createHash('sha256')");
    expect(route).toContain('addressHash');
    expect(route).toContain('p_limit: 8');
    expect(route).toContain('p_limit: 40');
    expect(route).toContain('if (usernameLimit.error || addressLimit.error)');
  });

  it('keeps the username mapping private and limits the rate-limit RPC to service_role', () => {
    expect(migration).toContain('grant update (username) on public.users to authenticated');
    expect(migration).toContain('create trigger zz_auth_users_sync_coursepulse_username');
    expect(migration).toContain('drop trigger if exists zz_auth_users_sync_coursepulse_username');
    expect(migration).toContain('revoke all on private.username_login_rate_limits from public, anon, authenticated, service_role');
    expect(migration).toContain('grant execute on function public.consume_username_login_rate_limit(text, integer, integer)');
    expect(migration).toContain('to service_role');
    expect(migration).not.toMatch(/grant select on public\.users to anon/i);
  });
});
