import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101023000_coursepulse_response_trends.sql'),'utf8');
const api=readFileSync(resolve(process.cwd(),'app/api/analytics/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('weekly response trends',()=>{
  it('aggregates weekly response counts with the minimum-five suppression threshold',()=>{
    expect(migration).toMatch(/get_instructor_response_trends_filtered/);
    expect(migration).toMatch(/date_trunc\('week'/);
    expect(migration).toMatch(/having count\(distinct r\.id\)>=5/);
    expect(migration).toMatch(/p_department_id/);
  });
  it('returns trends from a role-scoped RPC rather than raw response queries',()=>{
    expect(api).toMatch(/get_instructor_response_trends_filtered/);
    expect(api).toMatch(/trends:trendResult\.data/);
    expect(api).not.toMatch(/anonymous_submissions/);
  });
  it('renders weekly trends in the instructor analytics view',()=>{
    expect(dashboard).toMatch(/const trendCharts=useMemo/);
    expect(dashboard).toMatch(/trend-chart-grid/);
    expect(dashboard).toMatch(/Weekly response trend/);
  });
});
