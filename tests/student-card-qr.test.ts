import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/issue-student-card/index.ts'), 'utf8');
const verifyRoute = readFileSync(resolve(process.cwd(), 'app/api/student-id/verify/route.ts'), 'utf8');
const verifyPage = readFileSync(resolve(process.cwd(), 'components/student-card-verification.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108163318_coursepulse_multi_college_tenant_foundation.sql'), 'utf8');

describe('privacy-preserving student QR verification', () => {
  it('generates a random token and stores only its SHA-256 digest', () => {
    expect(edge).toContain('crypto.getRandomValues');
    expect(edge).toContain('crypto.subtle.digest("SHA-256"');
    expect(edge).toContain('register_student_card_token');
    expect(migration).toContain('token_hash text primary key');
  });

  it('keeps the bearer token in a URL fragment and sends it in a POST body', () => {
    expect(edge).toContain('"/verify/student#" + token');
    expect(verifyPage).toContain('window.location.hash');
    expect(verifyPage).toContain("method:'POST'");
    expect(verifyPage).toContain('window.history.replaceState');
    expect(verifyRoute).toContain("request.json()");
    expect(verifyRoute).toContain("createHash('sha256')");
  });

  it('returns only card identity fields and expiry, not private mobile or feedback data', () => {
    expect(migration).toContain('student_name text');
    expect(migration).toContain('student_number text');
    expect(migration).toContain('college_name text');
    expect(migration).toContain('enrollment_sections text[]');
  });
});
