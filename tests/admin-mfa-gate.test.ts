import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const gate = readFileSync(resolve(process.cwd(), 'components/admin-mfa-gate.tsx'), 'utf8');

describe('administrator MFA enrollment experience', () => {
  it('checks existing factors without silently deleting unfinished enrollment', () => {
    expect(gate).toContain("factor.status==='verified'");
    expect(gate).toContain("factor.status!=='verified'");
    expect(gate).not.toContain('for(const factor of data?.totp??[])');
  });

  it('requires an explicit user action before replacing pending factors', () => {
    expect(gate).toContain("mode==='pending'");
    expect(gate).toContain("Restart authenticator setup");
    expect(gate).toContain("onClick={()=>void startEnrollment()}");
    expect(gate).toContain('for(const pendingId of pendingFactorIds)');
    expect(gate).toContain("mode==='start'");
    expect(gate).toContain('Set up authenticator');
  });

  it('requires a successful TOTP challenge and verification for the existing factor', () => {
    expect(gate).toContain("supabase.auth.mfa.challenge({factorId})");
    expect(gate).toContain("supabase.auth.mfa.verify({factorId,challengeId:challenge.id");
    expect(gate).toContain('router.refresh()');
  });
});
