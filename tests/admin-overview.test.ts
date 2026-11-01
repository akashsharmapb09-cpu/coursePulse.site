import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route=readFileSync(resolve(process.cwd(),'app/api/admin/overview/route.ts'),'utf8');
const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101074059_admin_dashboard_overview.sql'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('administrator institution overview',()=>{
  it('uses an authenticated administrator-only API and MFA-protected aggregate RPC',()=>{
    expect(route).toContain('getCurrentUser(supabase)');
    expect(route).toContain("auth.profile.role !== 'ADMIN'");
    expect(route).toContain("rpc('get_admin_dashboard_overview')");
    expect(migration).toContain("private.current_app_role() is distinct from 'ADMIN'::public.app_role");
    expect(migration).toContain("auth.jwt()->>'aal'");
  });

  it('returns counts and ratings only from aggregate data, never individual answer payloads',()=>{
    expect(migration).toContain('total_responses bigint');
    expect(migration).toContain('participation_rate numeric');
    expect(migration).toContain('average_rating numeric');
    expect(migration).toContain('having count(*)>=5');
    expect(migration).not.toMatch(/returns table\s*\([^)]*\b(student_id|answers)\b/is);
    expect(migration).toContain("'Fewer than five submissions'");
  });

  it('shows institution KPIs and low-participation alerts in the admin console',()=>{
    expect(dashboard).toContain('/api/admin/overview');
    expect(dashboard).toContain('Institution overview');
    expect(dashboard).toContain('Low participation alerts');
    expect(dashboard).toContain('Average rating includes only question groups with at least five submissions');
  });
});
