import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031204219_coursepulse_student_feedback_progress.sql'),'utf8');
const route=readFileSync(resolve(process.cwd(),'app/api/feedback/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('student feedback progress contract',()=>{
  it('defines the student progress RPC through the private eligibility ledger only',()=>{
    expect(migration).toContain('create or replace function private.get_student_feedback_status');
    expect(migration).toContain('left join private.feedback_eligibility');
    expect(migration).toContain('coalesce(e.consumed,false)');
    expect(migration).not.toContain('anonymous_submissions');
    expect(migration).toContain('grant execute on function public.get_student_feedback_status() to authenticated');
  });
  it('loads completion state without exposing answer rows',()=>{
    expect(route).toContain("rpc('get_student_feedback_status')");
    expect(route).toContain('submittedByForm');
    expect(route).not.toContain("from('anonymous_submissions')");
    expect(route).not.toContain("from('feedback_eligibility')");
  });
  it('renders pending and completed form states',()=>{
    expect(dashboard).toContain('Pending responses');
    expect(dashboard).toContain('completed');
    expect(dashboard).toContain('!f.submitted');
  });
  it('calculates completion against only forms returned to the signed-in student',()=>{
    expect(dashboard).toContain('const completed=feedback.filter(f=>f.submitted).length');
    expect(dashboard).toContain('completionPercent:feedback.length?Math.round(completed/feedback.length*100):0');
    expect(dashboard).toContain('Your feedback progress');
    expect(dashboard).toContain('Based only on feedback forms available to your enrolled courses.');
  });
  it('exposes progress accessibly without other student participation data',()=>{
    expect(dashboard).toContain('role="progressbar"');
    expect(dashboard).toContain('aria-valuemin={0}');
    expect(dashboard).toContain('aria-valuemax={100}');
    expect(dashboard).toContain('aria-valuenow={stats.completionPercent}');
    expect(dashboard).not.toContain('other students completed');
  });
});
