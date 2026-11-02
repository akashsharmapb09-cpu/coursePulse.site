import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031205554_coursepulse_feedback_deadlines_and_completed_visibility.sql'),'utf8');
const route=readFileSync(resolve(process.cwd(),'app/api/feedback/route.ts'),'utf8');
const response=readFileSync(resolve(process.cwd(),'app/api/responses/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('feedback deadline and progress contracts',()=>{
  it('stores deadlines and blocks submissions after deadline at the database boundary',()=>{
    expect(migration).toMatch(/add column if not exists due_at timestamptz/i);
    expect(migration).toMatch(/now\(\)>=v_due_at/);
    expect(migration).toMatch(/before insert on public\.anonymous_submissions/);
    expect(route).toMatch(/due_at: parsed\.data\.due_at/);
  });
  it('lets enrolled students revisit only their own completed closed forms',()=>{
    expect(migration).toMatch(/feedback\.is_open=true/);
    expect(migration).toMatch(/e\.consumed=true/);
    expect(migration).toMatch(/e\.student_id=\(select auth\.uid\(\)\)/);
  });
  it('shows expired forms without allowing a response action',()=>{
    expect(dashboard).toMatch(/const expired=Boolean\(f\.due_at/);
    expect(dashboard).toMatch(/!expired/);
  });
  it('submits through the anonymous feedback RPC only',()=>{
    expect(response).toMatch(/submit_anonymous_feedback/);
    expect(response).not.toMatch(/from\('anonymous_submissions'\)/);
    expect(response).not.toMatch(/from\('responses'\)/);
  });
});
