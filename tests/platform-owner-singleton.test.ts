import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20261109072000_coursepulse_single_platform_super_admin_owner.sql'
), 'utf8');

describe('single Platform Super Admin owner', () => {
  it('enforces a maximum of one platform owner at the database level', () => {
    expect(migration).toContain('create unique index if not exists platform_admins_single_owner_idx');
    expect(migration).toContain('on private.platform_admins ((true))');
    expect(migration).toContain('if v_memberships > 1 then');
  });

  it('prevents client roles from provisioning, transferring or deleting the platform owner', () => {
    expect(migration).toContain('revoke insert, update, delete, truncate, references, trigger');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('Trusted out-of-band database operator access');
  });
});
