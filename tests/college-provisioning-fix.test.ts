import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261109074000_coursepulse_fix_platform_college_provisioning.sql'),
  'utf8',
);
const edgeFunction = readFileSync(
  resolve(process.cwd(), 'supabase/functions/create-college-workspace/index.ts'),
  'utf8',
);

describe('CoursePulse platform college provisioning hotfix', () => {
  it('grants the Edge Function only the college and invitation table operations it needs', () => {
    expect(migration).toContain('grant select, insert, update, delete');
    expect(migration).toContain('on table public.organizations');
    expect(migration).toContain('on table public.organization_invitations');
    expect(migration).not.toContain('grant all on all tables');
  });

  it('keeps HOD listing result types aligned with the declared TEXT columns', () => {
    expect(migration).toContain('coalesce(a.email, u.email)::text');
    expect(migration).toContain('u.full_name::text');
  });

  it('writes platform audit records through a private-table-safe, service-role-only RPC', () => {
    expect(migration).toContain('platform_record_college_invitation_audit');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('from public, anon, authenticated, service_role');
    expect(edgeFunction).toContain('admin.rpc("platform_record_college_invitation_audit"');
    expect(edgeFunction).not.toContain('admin.from("platform_admin_audit")');
  });

  it('logs database error details internally but does not expose SQL errors in the HTTP response', () => {
    expect(edgeFunction).toContain('organization insert failed');
    expect(edgeFunction).toContain('organizationError?.details');
    expect(edgeFunction).toContain('Please retry; if it continues, contact support.');
  });
});
