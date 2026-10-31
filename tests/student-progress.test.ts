import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031204219_coursepulse_student_feedback_progress.sql'),'utf8');
const route=readFileSync(resolve(process.cwd(),'app/api/feedback/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('student feedback progress contract',()=>{
  it('defines the student progress RPC through the private eligibility ledger only',()=>{
    expect(migration).toMatch(/create or replace function private\.get_student_feedback_status/);
    expect(migration).toMatch(/left join private\.feedback_eligibility/);
    expect(migration).toMatch(/coalesce\(e\.consumed,false\)/);
    expect(migration).not.toMatch(/anonymous_submissions/);
    expect(migration).toMatch(/grant execute on function public\.get_student_feedback_status\(\) to authenticated/);
  });
  it('loads completion state without exposing answer rows',()=>{
    expect(route).toMatch(/rpc\('get_student_feedback_status'\)/);
    expect(route).toMatch(/submittedByForm/);
    expect(route).not.toMatch(/from\('anonymous_submissions'\)/);
    expect(route).not.toMatch(/from\('feedback_eligibility'\)/);
  });
  it('renders pending and completed form states',()=>{
    expect(dashboard).toMatch(/Pending responses/);
    expect(dashboard).toMatch(/completed/);
    expect(dashboard).toMatch(/!f\.submitted/);
  });
});
