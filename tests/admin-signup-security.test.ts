import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const grant = readFileSync(resolve(process.cwd(), 'app/api/admin-signup/grant/route.ts'), 'utf8');
const http = readFileSync(resolve(process.cwd(), 'lib/http.ts'), 'utf8');
const prepare = readFileSync(resolve(process.cwd(), 'app/api/admin-signup/prepare/route.ts'), 'utf8');

describe('administrator signup security controls', () => {
  it('requires a non-anonymous authenticated user before admin promotion', () => {
    expect(grant).toContain("supabase.auth.getUser()");
    expect(grant).toContain("!user || user.is_anonymous");
  });

  it('enforces a per-user database rate limit before checking the admin code', () => {
    const limiter = grant.indexOf("protectMutation(request, supabase, 'admin-signup:route', 5, 900)");
    const verifyCode = grant.indexOf('isValidAdminSignupCode(body.code)');
    const rpc = grant.indexOf("supabase.rpc('claim_admin_signup'");
    expect(limiter).toBeGreaterThan(-1);
    expect(verifyCode).toBeGreaterThan(limiter);
    expect(rpc).toBeGreaterThan(limiter);
    expect(http).toContain("'admin-signup:route'");
    expect(http).toContain("'admin-signup:claim'");
  });

  it('fails closed when the database rate limiter errors and returns Retry-After on throttling', () => {
    expect(http).toContain("if (error) return jsonError('Mutation protection is temporarily unavailable.");
    expect(http).toContain("'Retry-After': String(windowSeconds)");
    expect(http).toContain('status: 429');
  });

  it('requires identity confirmation before admin claim', () => {
    expect(grant).toContain('user.email_confirmed_at || user.confirmed_at');
    expect(grant).toContain('user.phone_confirmed_at || user.confirmed_at');
    expect(grant).toContain("provider !== 'google' && !providers.includes('google')");
  });

  it('does not accept admin role metadata in the public student signup form', () => {
    const signup = readFileSync(resolve(process.cwd(), 'components/login-form.tsx'), 'utf8');
    expect(signup).toContain("data: { full_name: name.trim() }");
    expect(signup).not.toContain('requested_role');
    expect(signup).not.toContain('admin_signup_code');
    expect(prepare).toContain('isValidAdminSignupCode(body.code)');
  });
});
