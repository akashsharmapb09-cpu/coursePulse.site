import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const login = readFileSync(resolve(process.cwd(), 'components/login-form.tsx'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/auth/username-login/route.ts'), 'utf8');

describe('authentication response privacy', () => {
  it('uses the same public sign-in failure for unknown usernames and incorrect passwords', () => {
    expect(login).toContain('Sign-in failed. Check your username and password and try again.');
    expect(route).toContain('Sign-in failed. Check your username and password and try again.');
    expect(route).toContain('const dummyEmail =');
    expect(login).not.toContain('e.message');
    expect(login).not.toContain('error.message');
  });

  it('uses generic signup and password-reset confirmations', () => {
    expect(login).toContain('If an account can be created, verification instructions will be sent.');
    expect(login).toContain('If an account exists for this email, password reset instructions can be sent.');
  });
});
