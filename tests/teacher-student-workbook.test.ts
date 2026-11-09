import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseTeacherStudentWorkbook } from '../lib/teacher-student-workbook';

const importRoute = readFileSync(resolve(process.cwd(), 'app/api/teacher/roster/import/route.ts'), 'utf8');
const templateRoute = readFileSync(resolve(process.cwd(), 'app/api/teacher/roster/template/route.ts'), 'utf8');
const ui = readFileSync(resolve(process.cwd(), 'components/teacher-roster.tsx'), 'utf8');
const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/invite-college-users/index.ts'), 'utf8');

async function workbook(options?: {
  secondStudent?: boolean;
  duplicateMobile?: boolean;
  duplicateRollNumber?: boolean;
  mixedSections?: boolean;
  formula?: boolean;
}) {
  const book = new ExcelJS.Workbook();
  const students = book.addWorksheet('Students');
  students.addRow(['full_name', 'mobile', 'student_number', 'section']);
  students.addRow(['Aarav Sharma', '+919876543210', 'CSE-001', 'A']);
  if (options?.secondStudent) {
    students.addRow([
      'Asha Sharma',
      options.duplicateMobile ? '9876543210' : '+919876543211',
      options.duplicateRollNumber ? 'CSE-001' : 'CSE-002',
      options.mixedSections ? 'B' : 'A',
    ]);
  }
  if (options?.formula) students.getCell('B2').value = { formula: '"+919876543210"' };
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe('teacher Excel student roster import', () => {
  it('parses student details and normalizes Indian mobile numbers', async () => {
    const rows = await parseTeacherStudentWorkbook(await workbook());
    expect(rows).toEqual([{
      fullName: 'Aarav Sharma',
      mobile: '+919876543210',
      studentNumber: 'CSE-001',
      section: 'A',
    }]);
  });

  it('rejects duplicate mobile numbers and duplicate roll numbers in one workbook', async () => {
    await expect(parseTeacherStudentWorkbook(await workbook({
      secondStudent: true,
      duplicateMobile: true,
    }))).rejects.toThrow('duplicate mobile number');

    await expect(parseTeacherStudentWorkbook(await workbook({
      secondStudent: true,
      duplicateRollNumber: true,
    }))).rejects.toThrow('duplicate roll number');
  });

  it('requires one section per workbook', async () => {
    await expect(parseTeacherStudentWorkbook(await workbook({
      secondStudent: true,
      mixedSections: true,
    }))).rejects.toThrow('only one section');
  });

  it('rejects formula cells rather than trusting cached workbook values', async () => {
    await expect(parseTeacherStudentWorkbook(await workbook({ formula: true })))
      .rejects.toThrow('formulas are not allowed');
  });

  it('requires the Students sheet and validates mandatory student fields', async () => {
    const empty = new ExcelJS.Workbook();
    empty.addWorksheet('Roster');
    await expect(parseTeacherStudentWorkbook(Buffer.from(await empty.xlsx.writeBuffer())))
      .rejects.toThrow('worksheet named "Students"');

    const missing = new ExcelJS.Workbook();
    const sheet = missing.addWorksheet('Students');
    sheet.addRow(['full_name', 'mobile', 'student_number']);
    sheet.addRow(['Aarav Sharma', '+919876543210', 'CSE-001']);
    await expect(parseTeacherStudentWorkbook(Buffer.from(await missing.xlsx.writeBuffer())))
      .rejects.toThrow('missing required columns: section');
  });

  it('caps each workbook at 100 students', async () => {
    const book = new ExcelJS.Workbook();
    const students = book.addWorksheet('Students');
    students.addRow(['full_name', 'mobile', 'student_number', 'section']);
    for (let index = 1; index <= 101; index += 1) {
      students.addRow(['Student ' + index, '+9198000000' + String(index).padStart(2, '0'), 'ROLL-' + index, 'A']);
    }
    await expect(parseTeacherStudentWorkbook(Buffer.from(await book.xlsx.writeBuffer())))
      .rejects.toThrow('maximum of 100 students');
  });

  it('verifies teacher role and assigned course before invoking the secure invitation service', () => {
    expect(importRoute).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(importRoute).toContain("'get_instructor_students'");
    expect(importRoute).toContain("functions.invoke('invite-college-users'");
    expect(importRoute).toContain("role: 'STUDENT' as const");
    expect(importRoute).toContain("protectMutation(request, supabase, 'admin:user-update'");
    expect(importRoute).toContain('MAX_FILE_BYTES = 4 * 1024 * 1024');
    expect(importRoute).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(importRoute).not.toContain('organization_id: form');
  });

  it('builds a teacher-only mobile roster template and keeps course selection tied to the upload', () => {
    expect(templateRoute).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(templateRoute).toContain("rpc('get_instructor_students'");
    expect(templateRoute).toContain("addWorksheet('Students')");
    expect(templateRoute).toContain("key: 'mobile'");
    expect(templateRoute).toContain("key: 'student_number'");
    expect(templateRoute).toContain("key: 'section'");
    expect(ui).toContain('/api/teacher/roster/template?course_id=');
    expect(ui).toContain('/api/teacher/roster/import');
    expect(ui).toContain('Upload & create student accounts');
    expect(ui).toContain('one section per workbook');
  });

  it('checks organization-wide roll number collisions and keeps student invites assignment-scoped', () => {
    expect(edge).toContain('const isTeacher = profile.role === "INSTRUCTOR"');
    expect(edge).toContain('Teachers can invite students only.');
    expect(edge).toContain('assignedCourseIds.has(courseId)');
    expect(edge).toContain('student_directory');
    expect(edge).toContain('Duplicate student roll numbers are not allowed');
    expect(edge).toContain('organization_invitations');
    expect(edge).toContain('PENDING_SIGNUP');
    expect(edge).toContain('student_number: invite.role === "STUDENT" ? invite.student_number : null');
  });
});
