import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/create-college-workspace/index.ts'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/platform/organizations/route.ts'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'app/super-admin/page.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108164316_coursepulse_first_head_claim_and_platform_update.sql'), 'utf8');

describe('CoursePulse platform administration', () => {
  it('requires platform-admin identity and MFA before creating a college', () => {
    expect(edge).toContain('claims.aal !== "aal2"');
    expect(edge).toContain('caller.rpc("platform_is_admin")');
    expect(edge).toContain('organization_invitations');
    expect(edge).toContain('inviteUserByEmail');
    expect(route).toContain("functions.invoke('create-college-workspace'");
  });

  it('separates platform administration from college Head accounts', () => {
    expect(page).toContain("rpc('platform_is_admin')");
    expect(migration).toContain('private.platform_admins');
    expect(migration).toContain('private.is_platform_admin()');
  });

  it('does not present subscription labels as payment processing', () => {
    const component = readFileSync(resolve(process.cwd(), 'components/platform-admin-dashboard.tsx'), 'utf8');
    expect(component).toContain('metadata only');
    expect(component).not.toContain('chargeCustomer');
    expect(component).not.toContain('paymentIntent');
  });
});
