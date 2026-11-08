import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108160000_coursepulse_monthly_academic_reports.sql'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/admin/monthly-reports/route.ts'), 'utf8');

describe('scheduled monthly academic report archive', () => {
  it('stores only aggregate groups meeting the minimum five-response threshold', () => {
    expect(migration).toContain('public.anonymous_submissions');
    expect(migration).toContain('having count(*) >= 5');
    expect(migration).toContain('average_rating');
    expect(migration).toContain('recommendation');
    expect(migration).not.toMatch(/student_id|answers,|comments/i);
  });

  it('limits archive access to the MFA-protected College Head', () => {
    expect(migration).toContain('monthly_academic_reports_head_read');
    expect(migration).toContain('private.is_admin()');
    expect(route).toContain("auth.profile.role !== 'ADMIN'");
    expect(route).toContain("from('monthly_academic_reports')");
  });

  it('schedules the previous month archive on the first day of each month', () => {
    expect(migration).toContain("'15 0 1 * *'");
    expect(migration).toContain('coursepulse-monthly-academic-reports');
    expect(migration).toContain("now() - interval ''1 month''");
  });
});
