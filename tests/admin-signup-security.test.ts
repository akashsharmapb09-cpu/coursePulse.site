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

  it('keeps HTTP and direct-RPC rate limits in independent buckets', () => {
    expect(grant).toContain("protectMutation(request, supabase, 'admin-signup:route', 5, 900)");
    expect(readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108103822_security_harden_admin_signup_and_rate_limit.sql'), 'utf8'))
      .toContain("private.consume_api_rate_limit('admin-signup:claim', 5, 900)");
  });

  it('creates all new Auth users as STUDENT and never promotes from user metadata', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108103822_security_harden_admin_signup_and_rate_limit.sql'), 'utf8');
    expect(migration).toContain("'STUDENT'::public.app_role");
    expect(migration).not.toContain("v_requested_role := upper");
    expect(migration).not.toContain("new.raw_user_meta_data ->> 'requested_role'");
    expect(migration).toContain("- 'requested_role'");
  });

  it('enables RLS on the private admin code settings table', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108104941_enable_rls_for_admin_signup_settings.sql'), 'utf8');
    expect(migration).toContain('ALTER TABLE private.admin_signup_settings ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('TO service_role');
  });

  it('supports a controlled previous-code grace period for secret rotation', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108105305_support_overlap_admin_signup_code_rotation.sql'), 'utf8');
    expect(migration).toContain('previous_code_sha256');
    expect(migration).toContain('extensions.digest(p_code, \'sha256\') = s.previous_code_sha256');
    expect(migration).toContain('extensions.digest(p_code, \'sha256\') = s.code_sha256');
  });

  it('requires identity confirmation before admin claim', () => {
    expect(grant).toContain('user.email_confirmed_at || user.confirmed_at');
    expect(grant).toContain('user.phone_confirmed_at || user.confirmed_at');
    expect(grant).toContain("provider !== 'google' && !providers.includes('google')");
  });

  it('keeps the privileged claim implementation in private schema with an invoker public wrapper', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108104616_isolate_admin_claim_rpc_in_private_schema.sql'), 'utf8');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION private.claim_admin_signup');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.claim_admin_signup');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.claim_admin_signup(text) FROM PUBLIC, anon');
  });

  it('does not accept admin role metadata in the public student signup form', () => {
    const signup = readFileSync(resolve(process.cwd(), 'components/login-form.tsx'), 'utf8');
    expect(signup).toContain("data: { full_name: name.trim() }");
    expect(signup).not.toContain('requested_role');
    expect(signup).not.toContain('admin_signup_code');
    expect(prepare).toContain('isValidAdminSignupCode(body.code)');
  });
});
