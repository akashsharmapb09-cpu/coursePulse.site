import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rateLimitMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261031202848_coursepulse_mutation_rate_limits.sql'),
  'utf8'
);
const http = readFileSync(resolve(process.cwd(), 'lib/http.ts'), 'utf8');
const nextConfig = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8');
const csp = readFileSync(resolve(process.cwd(), 'lib/security-csp.ts'), 'utf8');
const middleware = readFileSync(resolve(process.cwd(), 'middleware.ts'), 'utf8');

describe('mutation security contract', () => {
  it('stores rate-limit buckets in a private, non-readable ledger', () => {
    expect(rateLimitMigration).toMatch(/create table private\.api_rate_limits/i);
    expect(rateLimitMigration).toMatch(/revoke all on table private\.api_rate_limits from public, anon, authenticated, service_role/i);
    expect(rateLimitMigration).toMatch(/primary key \(user_id, action, window_start\)/i);
  });

  it('limits supported mutation scopes and returns a deny decision over the limit', () => {
    expect(rateLimitMigration).toMatch(/p_action not in \('courses:create','feedback:create','responses:submit'\)/i);
    expect(rateLimitMigration).toMatch(/return v_count <= p_limit/i);
  });

  it('rejects missing or cross-origin mutation origins', () => {
    expect(http).toMatch(/if \(!requestOrigin \|\| !allowedOrigins\.has\(requestOrigin\)\)/);
    expect(http).toMatch(/Cross-origin mutation rejected/);
  });

  it('fails closed when the rate-limit service is unavailable', () => {
    expect(http).toMatch(/if \(error\) return jsonError\('Mutation protection is temporarily unavailable[\s\S]*?503\)/);
    expect(http).toMatch(/data !== true/);
  });

  it('includes a dedicated password-change action in the rate-limit contract',()=>{
    expect(http).toMatch(/account:password-change/);
  });

  it('uses a per-request nonce CSP without unsafe script execution sources', () => {
    expect(middleware).toMatch(/crypto\.randomUUID\(\)/);
    expect(middleware).toMatch(/requestHeaders\.set\('Content-Security-Policy'/);
    expect(middleware).toMatch(/response\.headers\.set\('Content-Security-Policy'/);
    expect(csp).toMatch(/script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^\n]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^\n]*unsafe-eval/);
    expect(csp).not.toMatch(/script-src[^\n]*data:/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  it('does not rely on the deprecated browser XSS auditor', () => {
    expect(nextConfig).toMatch(/X-XSS-Protection', value: '0'/);
  });
});
