import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '../lib/security-csp';

describe('Content Security Policy', () => {
  const nonce = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=';

  it('uses a nonce and strict-dynamic instead of unsafe script execution', () => {
    const policy = buildContentSecurityPolicy(nonce);
    const scriptSrc = policy.split(';').find((item) => item.trim().startsWith('script-src'));

    expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain('data:');
  });

  it('blocks plugins and restricts script/object sources', () => {
    const policy = buildContentSecurityPolicy(nonce);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it('keeps inline style attributes separate from script execution', () => {
    const policy = buildContentSecurityPolicy(nonce);
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).toContain(`style-src 'self' 'nonce-${nonce}'`);
  });

  it('rejects missing or malformed nonces', () => {
    expect(() => buildContentSecurityPolicy('')).toThrow();
    expect(() => buildContentSecurityPolicy('bad nonce with spaces')).toThrow();
    expect(() => buildContentSecurityPolicy('<script>')).toThrow();
  });
});
