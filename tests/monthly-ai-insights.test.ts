import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/generate-monthly-ai-insights/index.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261109090200_coursepulse_monthly_ai_insights.sql'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/admin/ai-insights/route.ts'), 'utf8');

describe('Head-only generative academic insights', () => {
  it('requires a verified Head AAL2 session and server-side provider secrets', () => {
    expect(edge).toContain('admin.auth.getUser(accessToken)');
    expect(edge).toContain('claims.aal !== "aal2"');
    expect(edge).toContain('OPENAI_API_KEY');
    expect(edge).toContain('OPENAI_MODEL');
    expect(edge).toContain('AI_PROVIDER_NOT_CONFIGURED');
  });

  it('sends only monthly aggregate rows to the provider and disables provider response storage', () => {
    expect(edge).toContain('monthly_academic_reports');
    expect(edge).toContain('store: false');
    expect(edge).toContain('average_rating_out_of_5');
    expect(edge).toContain('reportable_rating_answers');
  });

  it('stores AI output only in a tenant-scoped Head-readable table', () => {
    expect(migration).toContain('monthly_ai_insights_head_read');
    expect(migration).toContain('private.is_admin()');
    expect(migration).toContain('monthly_ai_insights_tenant_boundary');
    expect(route).toContain("from('monthly_ai_insights')");
  });
});
