import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031210516_coursepulse_rating_distributions.sql'),'utf8');
const api=readFileSync(resolve(process.cwd(),'app/api/analytics/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('rating distribution reporting',()=>{
  it('aggregates rating buckets and suppresses each bucket below five',()=>{
    expect(migration).toMatch(/get_instructor_rating_distribution_filtered/);
    expect(migration).toMatch(/q\.value->>'type'='rating'/);
    expect(migration).toMatch(/having count\(distinct r\.id\)>=5/);
    expect(migration).toMatch(/private\.is_course_owner\(c\.id\)/);
  });
  it('returns rating distributions without raw answer data',()=>{
    expect(api).toMatch(/get_instructor_rating_distribution_filtered/);
    expect(api).toMatch(/rating_distributions/);
    expect(api).not.toMatch(/anonymous_submissions/);
  });
  it('renders per-question rating bars with counts',()=>{
    expect(dashboard).toMatch(/const ratingCharts=useMemo/);
    expect(dashboard).toMatch(/rating-distribution-grid/);
    expect(dashboard).toMatch(/rating-bar-fill/);
  });
});
