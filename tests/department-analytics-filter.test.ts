import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031210728_coursepulse_department_analytics_filter.sql'),'utf8');
const analytics=readFileSync(resolve(process.cwd(),'app/api/analytics/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('department category analytics filter',()=>{
  it('adds department scope to both aggregate and rating RPCs',()=>{
    expect(migration).toMatch(/p_department_id/);
    expect(migration).toMatch(/c\.department_id = p_department_id/);
    expect(migration).toMatch(/c\.department_id=p_department_id/);
  });
  it('validates department IDs and passes them to RPC arguments',()=>{
    expect(analytics).toMatch(/Invalid department ID/);
    expect(analytics).toMatch(/p_department_id:departmentId/);
  });
  it('shows department as an analytics category filter',()=>{
    expect(dashboard).toMatch(/analyticsDepartmentId/);
    expect(dashboard).toMatch(/All departments/);
  });
});
