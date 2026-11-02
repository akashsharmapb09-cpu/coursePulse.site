import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031215804_coursepulse_feedback_version_history.sql'),'utf8');
const api=readFileSync(resolve(process.cwd(),'app/api/feedback/route.ts'),'utf8');
const versionsApi=readFileSync(resolve(process.cwd(),'app/api/feedback/[id]/versions/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');
const prisma=readFileSync(resolve(process.cwd(),'prisma/schema.prisma'),'utf8');

describe('feedback form version history',()=>{
  it('stores form-definition snapshots only, protected by a private non-readable table',()=>{
    expect(migration).toMatch(/create table private\.feedback_versions/);
    expect(migration).toMatch(/revoke all on table private\.feedback_versions from public, anon, authenticated, service_role/);
    expect(migration).toMatch(/feedback_versions_deny_direct_access/);
    expect(migration).toMatch(/old\.form_schema/);
    expect(migration).toMatch(/old\.title/);
    expect(migration).toMatch(/old\.description/);
    expect(migration).toMatch(/old\.due_at/);
    expect(migration).not.toMatch(/insert into private\.feedback_versions[\s\S]{0,700}answers/);
  });
  it('automatically increments the form version only for definition changes',()=>{
    expect(migration).toMatch(/old\.title is distinct from new\.title/);
    expect(migration).toMatch(/old\.form_schema is distinct from new\.form_schema/);
    expect(migration).toMatch(/new\.version := old\.version \+ 1/);
    expect(migration).toMatch(/before update on public\.feedback/);
  });
  it('scopes history and restore functions to the form owner or an AAL2 admin',()=>{
    expect(migration).toMatch(/not private\.is_admin\(\) and not private\.is_course_owner\(v_course_id\)/);
    expect(migration).toMatch(/private\.restore_feedback_version/);
    expect(migration).toMatch(/for update/);
    expect(migration).toMatch(/public\.get_feedback_versions/);
    expect(migration).toMatch(/public\.restore_feedback_version/);
  });
  it('exposes read and restore endpoints with owner checks and mutation protection',()=>{
    expect(versionsApi).toMatch(/get_feedback_versions/);
    expect(versionsApi).toMatch(/restore_feedback_version/);
    expect(versionsApi).toMatch(/protectMutation/);
    expect(api).toMatch(/version/);
  });
  it('shows history and restore controls to instructors and administrators',()=>{
    expect(dashboard).toMatch(/onVersions\(f\)/);
    expect(dashboard).toMatch(/Version history/);
    expect(dashboard).toMatch(/Restore this version/);
    expect(prisma).toMatch(/version\s+Int\s+@default\(1\)/);
  });
});
