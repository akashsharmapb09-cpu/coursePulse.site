import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const helper=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031220141_coursepulse_feedback_eligibility_policy_helper.sql'),'utf8');
const eligibility=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031202355_coursepulse_anonymous_feedback_storage.sql'),'utf8');
const eligibilityPolicy=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031202452_coursepulse_anonymous_storage_policy_hardening.sql'),'utf8');
const policyDefinition=helper.slice(helper.indexOf('create policy feedback_select_scoped'));

describe('private feedback eligibility RLS boundary',()=>{
  it('keeps direct eligibility ledger reads revoked and RLS-denied',()=>{
    expect(eligibility).toMatch(/revoke all on table private\.feedback_eligibility from public, anon, authenticated, service_role/i);
    expect(eligibility).toMatch(/feedback_eligibility_deny_direct_access[\s\S]*?using \(false\)/i);
  });
  it('uses a narrow security-definer boolean helper for completed-form visibility',()=>{
    expect(helper).toMatch(/create or replace function private\.has_consumed_feedback_eligibility/);
    expect(helper).toMatch(/security definer[\s\S]*?set search_path = ''/i);
    expect(helper).toMatch(/e\.feedback_id = p_feedback_id/);
    expect(helper).toMatch(/e\.student_id = \(select auth\.uid\(\)\)/);
    expect(helper).toMatch(/e\.consumed = true/);
    expect(helper).toMatch(/grant execute on function private\.has_consumed_feedback_eligibility\(uuid\) to authenticated/i);
  });
  it('removes direct table access from the feedback select policy',()=>{
    expect(helper).toMatch(/drop policy if exists feedback_select_scoped on public\.feedback/i);
    expect(helper).toMatch(/private\.has_consumed_feedback_eligibility\(id\)/);
    expect(helper).not.toMatch(/exists\s*\(\s*select 1\s*from private\.feedback_eligibility/i);
  });
});
