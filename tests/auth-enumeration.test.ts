import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const login=readFileSync(resolve(process.cwd(),'components/login-form.tsx'),'utf8');
const phoneLink=readFileSync(resolve(process.cwd(),'components/phone-account-link.tsx'),'utf8');

describe('phone-first authentication response privacy',()=>{
  it('uses the same public sign-in failure regardless of whether an account exists',()=>{
    expect(login).toContain("setError('Sign-in failed. Check your credentials and try again.')");
    expect(login).not.toContain('e.message');
    expect(login).not.toContain('error.message');
  });

  it('creates new accounts with phone/password and verifies signup with SMS OTP',()=>{
    expect(login).toContain('phone: phoneNumber!');
    expect(login).toContain('supabase.auth.signUp({');
    expect(login).toContain("type: 'sms'");
    expect(login).toContain("mode === 'verify-signup'");
    expect(login).not.toContain('emailRedirectTo');
    expect(login).not.toContain('supabase.auth.signUp({ email');
  });

  it('uses phone OTP for password recovery and updates the password after verification',()=>{
    expect(login).toContain('supabase.auth.signInWithOtp({');
    expect(login).toContain('shouldCreateUser: false');
    expect(login).toContain('supabase.auth.updateUser({ password })');
    expect(login).toContain("mode === 'verify-reset'");
  });

  it('keeps email sign-in only as an explicit transition path for existing accounts',()=>{
    expect(login).toContain("mode === 'legacy-signin'");
    expect(login).toContain('Use email sign-in temporarily');
    expect(login).not.toContain("mode === 'signup' ? 'Email address'");
  });

  it('allows existing signed-in accounts to link a phone and confirm it before mobile sign-in',()=>{
    expect(phoneLink).toContain("auth.updateUser({ phone: normalized })");
    expect(phoneLink).toContain("type: 'phone_change'");
    expect(phoneLink).toContain('Mobile number verified and linked');
  });
});
