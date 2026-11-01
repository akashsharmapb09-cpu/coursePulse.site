import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '../lib/safe-redirect';

describe('authentication confirmation redirect validation', () => {
  const origin = 'https://coursepulse.example';

  it('allows same-origin paths with query strings and fragments', () => {
    expect(safeRedirectPath('/dashboard', origin)).toBe('/dashboard');
    expect(safeRedirectPath('/dashboard?welcome=1#overview', origin)).toBe('/dashboard?welcome=1#overview');
  });

  it('rejects external, protocol-relative and backslash-based destinations', () => {
    expect(safeRedirectPath('https://attacker.example', origin)).toBe('/dashboard');
    expect(safeRedirectPath('//attacker.example/path', origin)).toBe('/dashboard');
    expect(safeRedirectPath('/\\\\attacker.example/path', origin)).toBe('/dashboard');
    expect(safeRedirectPath('/%5c%5cattacker.example/path', origin)).toBe('/%5c%5cattacker.example/path');
  });

  it('rejects control characters, missing paths and invalid origins', () => {
    expect(safeRedirectPath(null, origin)).toBe('/dashboard');
    expect(safeRedirectPath('dashboard', origin)).toBe('/dashboard');
    expect(safeRedirectPath('/dashboard\nLocation: https://attacker.example', origin)).toBe('/dashboard');
    expect(safeRedirectPath('/dashboard', 'not a valid origin')).toBe('/dashboard');
  });
});
