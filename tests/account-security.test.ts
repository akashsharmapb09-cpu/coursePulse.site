import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route=readFileSync(resolve(process.cwd(),'app/api/account/password/route.ts'),'utf8');
const http=readFileSync(resolve(process.cwd(),'lib/http.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');
const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101110000_coursepulse_account_password_rate_limit.sql'),'utf8');

describe('account password change security contract',()=>{
  it('requires an active authenticated account and a dedicated same-origin rate limit',()=>{
    expect(route).toMatch(/getCurrentUser\(supabase\)/);
    expect(route).toMatch(/protectMutation\(request,supabase,'account:password-change',5,3600\)/);
    expect(http).toMatch(/account:password-change/);
  });
  it('verifies the current password against the same account without replacing the active session',()=>{
    expect(route).toMatch(/persistSession:false/);
    expect(route).toMatch(/signInWithPassword/);
    expect(route).toMatch(/verified\.user\?\.id===auth\.user\.id/);
  });
  it('updates the password and attempts to revoke all active sessions',()=>{
    expect(route).toMatch(/supabase\.auth\.updateUser\(\{password:parsed\.data\.new_password\}\)/);
    expect(route).toMatch(/signOut\(\{scope:'global'\}\)/);
    expect(route).toMatch(/sessionsRevoked/);
  });
  it('keeps the password-change rate-limit action in the private ledger allowlist',()=>{
    expect(migration).toMatch(/account:password-change/);
    expect(migration).toMatch(/private\.consume_api_rate_limit/);
    expect(migration).toMatch(/revoke all on function private\.consume_api_rate_limit/);
  });
  it('exposes an authenticated account security form with password confirmation',()=>{
    expect(dashboard).toMatch(/Account security/);
    expect(dashboard).toMatch(/Current password/);
    expect(dashboard).toMatch(/Confirm new password/);
    expect(dashboard).toMatch(/\/api\/account\/password/);
  });
});
