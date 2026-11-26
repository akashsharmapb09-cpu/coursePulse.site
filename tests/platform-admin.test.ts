import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const page=readFileSync(resolve(process.cwd(),'app/super-admin/page.tsx'),'utf8');
const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261108164316_coursepulse_first_head_claim_and_platform_update.sql'),'utf8');
const legacyEdge=readFileSync(resolve(process.cwd(),'supabase/functions/create-college-workspace/index.ts'),'utf8');
describe('legacy platform administration modules',()=>{
 it('retains historical provisioning source while removing its page entry point',()=>{
  expect(legacyEdge).toContain('caller.rpc("platform_is_admin")');expect(legacyEdge).toContain('inviteUserByEmail');
  expect(migration).toContain('private.platform_admins');expect(migration).toContain('private.is_platform_admin()');
  expect(page).toContain("redirect('/dashboard')");expect(page).not.toContain("rpc('platform_is_admin')");
 });
});
