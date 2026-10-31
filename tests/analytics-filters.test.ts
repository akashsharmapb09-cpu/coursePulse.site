import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101020000_coursepulse_filtered_analytics.sql'),'utf8');
const analytics=readFileSync(resolve(process.cwd(),'app/api/analytics/route.ts'),'utf8');
const exportsRoute=readFileSync(resolve(process.cwd(),'app/api/exports/[format]/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('filtered aggregate analytics',()=>{
  it('uses a separate timestamped aggregate RPC with course, date and semester filters',()=>{
    expect(migration).toMatch(/get_instructor_aggregates_filtered/);
    expect(migration).toMatch(/submitted_at::date as submitted_on/);
    expect(migration).toMatch(/p_from_date/);
    expect(migration).toMatch(/p_to_date/);
    expect(migration).toMatch(/p_semester_id/);
    expect(migration).toMatch(/having count\(distinct n\.response_id\) >= 5/);
  });
  it('validates filter inputs and uses the filtered aggregate RPC',()=>{
    expect(analytics).toMatch(/Dates must use YYYY-MM-DD format/);
    expect(analytics).toMatch(/get_instructor_aggregates_filtered/);
    expect(exportsRoute).toMatch(/get_instructor_aggregates_filtered/);
  });
  it('exposes semester and date filters and passes them to export links',()=>{
    expect(dashboard).toMatch(/analyticsFromDate/);
    expect(dashboard).toMatch(/analyticsToDate/);
    expect(dashboard).toMatch(/analyticsSemesterId/);
    expect(dashboard).toMatch(/Semester<select/);
    expect(dashboard).toMatch(/analyticsQuery\(\)/);
  });
});
