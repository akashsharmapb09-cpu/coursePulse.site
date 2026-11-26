import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031203740_coursepulse_academic_admin_lifecycle.sql'),'utf8');
const departmentMigration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261031214742_coursepulse_admin_user_department_assignment.sql'),'utf8');
const http=readFileSync(resolve(process.cwd(),'lib/http.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'app/dashboard/page.tsx'),'utf8');
const middleware=readFileSync(resolve(process.cwd(),'middleware.ts'),'utf8');
const dashboardUi=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');
const rosterUi=readFileSync(resolve(process.cwd(),'components/admin-roster-panel.tsx'),'utf8');
const academicApi=readFileSync(resolve(process.cwd(),'app/api/admin/academic/route.ts'),'utf8');

describe('academic administration and account lifecycle contract',()=>{
  it('keeps HOD academic setup workbook-only and removes individual invitation controls',()=>{
    expect(dashboardUi).not.toMatch(/Create department/);
    expect(dashboardUi).not.toMatch(/Create academic semester/);
    expect(dashboardUi).not.toMatch(/Enroll student in course/);
    expect(dashboardUi).not.toMatch(/Assign teacher/);
    expect(rosterUi).toMatch(/Import departments, courses & teachers/);
    expect(rosterUi).not.toMatch(/Create invitation/);
    expect(rosterUi).not.toMatch(/Quick roster invitation/);
    expect(rosterUi).not.toMatch(/Invitation queue/);
  });
  it('requires explicit enrollment in the historical database model',()=>{
    expect(migration).toMatch(/course_enrollments e where e\.course_id=courses\.id and e\.student_id=\(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/join public\.course_enrollments e on e\.course_id=c\.id and e\.student_id=v_student_id/);
  });
  it('blocks suspended profiles in the historical role helper',()=>{
    expect(migration).toMatch(/where u\.id=\(select auth\.uid\(\)\) and u\.is_active=true/);
    expect(http).toMatch(/!profile\.is_active/);
  });
  it('protects the dashboard with Supabase Auth and routes users by role',()=>{
    expect(dashboard).toContain("from '@/components/dashboard'");
    expect(dashboard).toContain('supabase.auth.getUser()');
    expect(dashboard).toMatch(/redirect\('\/login/);
    expect(dashboard).toMatch(/profile\.role/);
    expect(dashboard).not.toContain('<PublicWorkspace />');
    expect(middleware).toMatch(/destination\.pathname\s*=\s*['"]\/login['"]/);
    expect(middleware).toMatch(/dashboard/);
    expect(middleware).not.toMatch(/status:\s*410/);
  });
  it('keeps audited academic API routes behind authenticated role checks',()=>{
    expect(academicApi).toMatch(/admin_record_audit/);
    expect(academicApi).toMatch(/getCurrentUser/);
    expect(migration).toMatch(/create table public\.audit_logs/);
    expect(middleware).not.toContain('The public college demo does not use authenticated API routes.');
  });
  it('supports historical department and semester policies without exposing them in the demo',()=>{
    expect(academicApi).toMatch(/z\.literal\('department_update'\)/);
    expect(academicApi).toMatch(/z\.literal\('semester_update'\)/);
    expect(academicApi).toMatch(/supabase\.from\('departments'\)\.update/);
    expect(academicApi).toMatch(/supabase\.from\('semesters'\)\.update/);
    expect(academicApi).toMatch(/department\.updated/);
    expect(academicApi).toMatch(/semester\.updated/);
    expect(dashboardUi).not.toMatch(/Update department/);
    expect(dashboardUi).not.toMatch(/Update semester/);
    expect(dashboardUi).not.toMatch(/Active semester/);
  });
  it('preserves the archived department assignment migration for reference only',()=>{
    expect(departmentMigration).toMatch(/create or replace function private\.admin_assign_user_department/);
    expect(departmentMigration).toMatch(/private\.is_admin\(\)/);
    expect(departmentMigration).toMatch(/private\.admin_record_audit/);
    expect(academicApi).toMatch(/admin_assign_user_department/);
    expect(dashboardUi).not.toMatch(/Assign user department/);
  });
  it('retains the existing academic tables in historical migrations',()=>{
    expect(migration).toMatch(/create table public\.course_enrollments/);
    expect(migration).toMatch(/create table public\.instructor_course_assignments/);
    expect(migration).toMatch(/add column department_id/);
    expect(migration).toMatch(/add column semester_id/);
  });
});
