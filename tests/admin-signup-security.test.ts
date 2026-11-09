import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const grant = readFileSync(resolve(process.cwd(), 'app/api/admin-signup/grant/route.ts'), 'utf8');
const signup = readFileSync(resolve(process.cwd(), 'components/login-form.tsx'), 'utf8');
const hierarchy = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261109064700_coursepulse_four_role_hierarchy_and_platform_controls.sql'), 'utf8');

describe('HOD provisioning is controlled only by Platform Super Admin', () => {
  it('blocks the legacy public HOD self-claim endpoint', () => {
    expect(grant).toContain('status: 403');
    expect(grant).toContain('HOD accounts are assigned only by a verified CoursePulse Platform Super Admin');
    expect(grant).not.toContain("supabase.rpc('claim_admin_signup'");
  });

  it('keeps public signups as Students and explains the role hierarchy', () => {
    expect(signup).toContain("data: { full_name: name.trim() }");
    expect(signup).toContain('Your account starts as a Student.');
    expect(signup).toContain('only CoursePulse Platform Super Admin can assign HOD access');
    expect(signup).not.toContain('requested_role');
    expect(signup).not.toContain('admin_signup_code');
  });

  it('revokes authenticated access to both legacy workspace-claim RPCs', () => {
    expect(hierarchy).toContain('revoke all on function private.claim_setup_workspace(text) from public, anon, authenticated');
    expect(hierarchy).toContain('revoke all on function private.claim_admin_signup(text) from public, anon, authenticated');
    expect(hierarchy).toContain('revoke all on function public.admin_claim_setup_workspace(text) from public, anon, authenticated');
    expect(hierarchy).toContain('revoke all on function public.claim_admin_signup(text) from public, anon, authenticated');
  });
});
