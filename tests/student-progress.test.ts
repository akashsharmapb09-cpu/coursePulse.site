import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route=readFileSync(resolve(process.cwd(),'app/api/feedback/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('student feedback progress contract',()=>{
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
