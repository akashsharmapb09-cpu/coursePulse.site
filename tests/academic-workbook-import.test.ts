import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseAcademicWorkbook } from '../lib/academic-workbook';

const importRoute = readFileSync(resolve(process.cwd(), 'app/api/admin/roster/import/route.ts'), 'utf8');
const templateRoute = readFileSync(resolve(process.cwd(), 'app/api/admin/roster/template/route.ts'), 'utf8');
const dashboard = readFileSync(resolve(process.cwd(), 'components/admin-roster-panel.tsx'), 'utf8');
const inviteFunction = readFileSync(resolve(process.cwd(), 'supabase/functions/invite-college-users/index.ts'), 'utf8');

async function workbookBuffer(options?: { duplicateTeacher?: boolean; formula?: boolean }) {
  const workbook = new ExcelJS.Workbook();
  const departments = workbook.addWorksheet('Departments');
  departments.addRow(['department_code', 'department_name']);
  departments.addRow(['CSE', 'Computer Science']);

  const courses = workbook.addWorksheet('Courses');
  courses.addRow(['course_code', 'course_name', 'department_code', 'description', 'status']);
  courses.addRow(['CS101', 'Programming', 'CSE', 'Introduction to programming', 'DRAFT']);

  const teachers = workbook.addWorksheet('Teachers');
  teachers.addRow(['teacher_name', 'mobile', 'department_code', 'course_codes']);
  teachers.addRow(['Asha Sharma', '+919876543210', 'CSE', 'CS101']);
  if (options?.duplicateTeacher) teachers.addRow(['Asha Sharma', '9876543210', 'CSE', 'CS101']);
  if (options?.formula) teachers.getCell('B2').value = { formula: '" +919876543210 "' };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('CoursePulse college workbook import', () => {
  it('parses the three sheets and normalizes teacher mobile numbers', async () => {
    const parsed = await parseAcademicWorkbook(await workbookBuffer());
    expect(parsed.departments).toEqual([{ code: 'CSE', name: 'Computer Science' }]);
    expect(parsed.courses).toEqual([{
      code: 'CS101',
      title: 'Programming',
      departmentCode: 'CSE',
      description: 'Introduction to programming',
      status: 'DRAFT',
    }]);
    expect(parsed.teachers).toEqual([{
      fullName: 'Asha Sharma',
      mobile: '+919876543210',
      departmentCode: 'CSE',
      courseCodes: ['CS101'],
    }]);
  });

  it('rejects duplicate teacher mobile numbers before any data is written', async () => {
    await expect(parseAcademicWorkbook(await workbookBuffer({ duplicateTeacher: true })))
      .rejects.toThrow('duplicate mobile number');
  });

  it('rejects formula cells rather than trusting calculated workbook content', async () => {
    await expect(parseAcademicWorkbook(await workbookBuffer({ formula: true })))
      .rejects.toThrow('formulas are not allowed');
  });

  it('requires HOD MFA and uses only the signed-in college tenant', () => {
    expect(importRoute).toContain('getCurrentUser(supabase)');
    expect(importRoute).toContain("auth.profile.role !== 'ADMIN'");
    expect(importRoute).toContain("protectMutation(request, supabase, 'admin:user-update'");
    expect(importRoute).toContain("from('departments')");
    expect(importRoute).toContain("from('courses')");
    expect(importRoute).toContain("invite-college-users");
    expect(importRoute).toContain("p_action: 'academic.workbook.imported'");
    expect(importRoute).not.toContain('organization_id: form');
    expect(importRoute).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('creates a downloadable HOD-only workbook template with all required worksheets', () => {
    expect(templateRoute).toContain("addWorksheet('Departments')");
    expect(templateRoute).toContain("addWorksheet('Courses')");
    expect(templateRoute).toContain("addWorksheet('Teachers')");
    expect(templateRoute).toContain("auth.profile.role !== 'ADMIN'");
    expect(templateRoute).toContain("key: 'mobile'");
    expect(templateRoute).toContain('coursepulse-college-workbook-template.xlsx');
    expect(dashboard).toContain('/api/admin/roster/import');
    expect(dashboard).toContain('/api/admin/roster/template');
  });

  it('returns account IDs only for already linked teacher accounts', () => {
    expect(inviteFunction).toContain('user_id: invited.user.id');
    expect(inviteFunction).toContain('user_id: Array.isArray(linked)');
    expect(inviteFunction).toContain('status: "PENDING_SIGNUP"');
    expect(inviteFunction).toContain('const isHead = profile.role === "ADMIN" && claims.aal === "aal2"');
    expect(inviteFunction).toContain('organization.status !== "ACTIVE"');
  });
});
