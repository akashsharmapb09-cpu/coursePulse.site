import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101013000_coursepulse_academic_admin_lifecycle.sql'),'utf8');
const http=readFileSync(resolve(process.cwd(),'lib/http.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'app/dashboard/page.tsx'),'utf8');
const academicApi=readFileSync(resolve(process.cwd(),'app/api/admin/academic/route.ts'),'utf8');

describe('academic administration and account lifecycle contract',()=>{
  it('requires explicit enrollment for student course and feedback visibility',()=>{
    expect(migration).toMatch(/course_enrollments e where e\.course_id=courses\.id and e\.student_id=\(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/join public\.course_enrollments e on e\.course_id=c\.id and e\.student_id=v_student_id/);
  });
  it('blocks suspended profiles through the role helper',()=>{
    expect(migration).toMatch(/where u\.id=\(select auth\.uid\(\)\) and u\.is_active=true/);
    expect(http).toMatch(/!profile\.is_active/);
  });
  it('requires AAL2 for administrator authorization and role changes',()=>{
    expect(migration).toMatch(/auth\.jwt\(\)->>'aal'\)='aal2'/);
    expect(migration).toMatch(/last active administrator cannot be demoted or suspended/i);
    expect(dashboard).toMatch(/AdminMfaGate/);
  });
  it('writes privileged academic actions to the audit RPC',()=>{
    expect(academicApi).toMatch(/admin_record_audit/);
    expect(migration).toMatch(/create table public\.audit_logs/);
  });
  it('supports enrollment, instructor assignments and academic metadata',()=>{
    expect(migration).toMatch(/create table public\.course_enrollments/);
    expect(migration).toMatch(/create table public\.instructor_course_assignments/);
    expect(migration).toMatch(/add column department_id/);
    expect(migration).toMatch(/add column semester_id/);
  });
});
