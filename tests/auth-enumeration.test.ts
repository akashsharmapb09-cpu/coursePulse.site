import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const login=readFileSync(resolve(process.cwd(),'components/login-form.tsx'),'utf8');

describe('authentication response privacy',()=>{
  it('uses the same public sign-in failure regardless of whether an email exists',()=>{
    expect(login).toContain("setError('Sign-in failed. Check your credentials and try again.')");
    expect(login).not.toContain('e.message');
    expect(login).not.toContain('error.message');
  });
  it('uses generic signup and password-reset confirmations',()=>{
    expect(login).toContain('If an account can be created for this email, confirmation instructions will be sent.');
    expect(login).toContain('If an account exists for this email, password reset instructions can be sent.');
  });
});
