import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const foundation = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108163318_coursepulse_multi_college_tenant_foundation.sql'), 'utf8');
const scopedRpcs = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108163853_coursepulse_tenant_privilege_rpc_scoping.sql'), 'utf8');
const platform = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108165428_coursepulse_organization_and_platform_admin_controls.sql'), 'utf8');
const activation = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261109045137_coursepulse_first_head_email_activation.sql'), 'utf8');

describe('college tenant isolation', () => {
  it('adds an organization boundary to academic, feedback, eligibility and notification data', () => {
    for (const table of ['users','courses','feedback','responses','anonymous_submissions','departments','semesters','course_enrollments','instructor_course_assignments','student_suggestions','teacher_notifications']) {
      expect(foundation).toContain(`alter table public.${table} add column if not exists organization_id`);
    }
    expect(foundation).toContain('as restrictive for all to authenticated');
    expect(foundation).toContain('private.current_organization_id()');
  });

  it('scopes privileged aggregate and monthly report functions to a single organization', () => {
    expect(scopedRpcs).toContain('where c.organization_id=private.current_organization_id()');
    expect(scopedRpcs).toContain('where f.organization_id=private.current_organization_id()');
    expect(scopedRpcs).toContain('where s.organization_id=p_org');
    expect(scopedRpcs).toContain('where a.organization_id=p_org');
    expect(scopedRpcs).toContain("for o in select id from public.organizations where status='ACTIVE'");
  });

  it('keeps platform administration separate and MFA-protected', () => {
    expect(foundation).toContain('private.platform_admins');
    expect(foundation).toContain("(select auth.jwt()->>'aal')='aal2'");
    expect(platform).toContain('private.is_platform_admin()');
    expect(platform).toContain('platform_admin_audit');
  });

  it('activates a newly invited college only after its first Head verifies email or phone', () => {
    expect(activation).toContain("then 'ACTIVE' else 'SETUP_REQUIRED' end");
    expect(activation).toContain('auth_activate_college_after_verification');
    expect(activation).toContain('old.email_confirmed_at is null and new.email_confirmed_at is not null');
    expect(activation).toContain('o.owner_user_id=new.id');
  });
});
