import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108161000_coursepulse_monthly_teacher_notices.sql'), 'utf8');
const weightingFix = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108161300_coursepulse_teacher_notice_form_weighting.sql'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/admin/teacher-notifications/route.ts'), 'utf8');

describe('scheduled private teacher meeting requests', () => {
  it('stores Head-configured review thresholds under MFA-only RLS', () => {
    expect(migration).toContain('monthly_report_settings_head_manage');
    expect(migration).toContain('private.is_admin()');
    expect(migration).toContain('rating_threshold');
    expect(migration).toContain('minimum_responses');
    expect(route).toContain("from('monthly_report_settings')");
    expect(route).toContain('updated_by: auth.user.id');
  });

  it('sends scheduled notifications only to active assigned instructors below the saved threshold', () => {
    expect(migration).toContain('private.notify_monthly_low_rated_teachers');
    expect(migration).toContain("u.role = 'INSTRUCTOR'::public.app_role");
    expect(migration).toContain('u.is_active = true');
    expect(migration).toContain('metric.response_count >= v_minimum');
    expect(migration).toContain('metric.average_rating < v_threshold');
    expect(migration).toContain('on conflict (recipient_id, category, period_start) do nothing');
  });

  it('counts response volumes once per form, not once per rating question', () => {
    expect(weightingFix).toContain('eligible_forms as');
    expect(weightingFix).toContain('avg(group_average)::numeric as form_average');
    expect(weightingFix).toContain('max(responses)::bigint as responses');
    expect(weightingFix).toContain('sum(form.responses)::bigint as response_count');
  });

  it('runs reports and teacher notifications as one scheduled monthly close', () => {
    expect(migration).toContain('private.run_monthly_academic_close');
    expect(migration).toContain("'15 0 1 * *'");
    expect(migration).toContain('select private.run_monthly_academic_close');
  });
});
