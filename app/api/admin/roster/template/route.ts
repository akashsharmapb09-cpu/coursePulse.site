import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F6B52' } },
  alignment: { vertical: 'middle', horizontal: 'left' },
  border: { bottom: { style: 'thin', color: { argb: 'FF1F513C' } } },
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.height = 25;
  row.eachCell((cell) => { cell.style = headerStyle; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address };
}

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Sign in with your HOD account and complete MFA to download this template.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('HOD access is required.', 403);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CoursePulse';
  workbook.subject = 'College departments, courses and teacher onboarding';
  workbook.title = 'CoursePulse College Setup Workbook';
  workbook.created = new Date();

  const guide = workbook.addWorksheet('Instructions');
  guide.columns = [{ width: 25 }, { width: 72 }, { width: 46 }];
  guide.mergeCells('A1:C1');
  guide.getCell('A1').value = 'CoursePulse · College Setup Workbook';
  guide.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF173F30' } };
  guide.getCell('A1').alignment = { vertical: 'middle' };
  guide.getRow(1).height = 32;
  guide.addRow(['Worksheet', 'What to enter', 'Example']);
  guide.getRow(2).eachCell((cell) => { cell.style = headerStyle; });
  guide.addRows([
    ['Departments', 'One row per department. department_code must be unique in your college.', 'CSE | Computer Science'],
    ['Courses', 'One row per course. department_code must match a department. Leave status blank to create a DRAFT course.', 'CS101 | Programming | CSE | Introductory programming | DRAFT'],
    ['Teachers', 'One row per teacher. Use the same department_code and list 1–25 course codes separated by semicolons.', 'Asha Sharma | +919876543210 | CSE | CS101;CS102'],
    [],
    ['Important', 'Keep the worksheet names and column headings unchanged. Do not add formulas or hyperlinks in data cells.', ''],
    ['Account activation', 'CoursePulse sends an activation email to each teacher. Teachers set their own password; the HOD never receives or chooses it.', ''],
    ['Existing records', 'Matching department codes and course codes are updated/reused in your college. Other colleges are not affected.', ''],
    ['Limits', 'Maximum 200 departments, 500 courses and 100 teachers per workbook. A teacher can be assigned up to 25 courses.', ''],
    ['Course status', 'Allowed values: DRAFT or PUBLISHED. Blank status defaults to DRAFT so the HOD can review before students see it.', ''],
    ['Course assignment', 'Every teacher course code must exist in this workbook or already exist in your college, and belong to that teacher department.', ''],
  ]);
  guide.getColumn(1).font = { bold: true, color: { argb: 'FF27533E' } };
  guide.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  guide.getColumn(3).alignment = { wrapText: true, vertical: 'top' };
  guide.eachRow((row, rowNumber) => { if (rowNumber > 2) row.height = 34; });
  guide.getRow(2).height = 25;

  const departments = workbook.addWorksheet('Departments');
  departments.columns = [
    { header: 'department_code', key: 'department_code', width: 22 },
    { header: 'department_name', key: 'department_name', width: 36 },
  ];
  styleHeader(departments);

  const courses = workbook.addWorksheet('Courses');
  courses.columns = [
    { header: 'course_code', key: 'course_code', width: 20 },
    { header: 'course_name', key: 'course_name', width: 36 },
    { header: 'department_code', key: 'department_code', width: 22 },
    { header: 'description', key: 'description', width: 54 },
    { header: 'status', key: 'status', width: 18 },
  ];
  styleHeader(courses);
  courses.getColumn(1).numFmt = '@';
  courses.getColumn(3).numFmt = '@';
  for (let row = 2; row <= 501; row += 1) {
    courses.getCell(row, 5).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"DRAFT,PUBLISHED"'],
      showErrorMessage: true,
      errorTitle: 'Invalid course status',
      error: 'Choose DRAFT or PUBLISHED.',
    };
  }

  const teachers = workbook.addWorksheet('Teachers');
  teachers.columns = [
    { header: 'teacher_name', key: 'teacher_name', width: 32 },
    { header: 'mobile', key: 'mobile', width: 24 },
    { header: 'department_code', key: 'department_code', width: 22 },
    { header: 'course_codes', key: 'course_codes', width: 48 },
  ];
  styleHeader(teachers);
  teachers.getColumn(4).alignment = { wrapText: true };

  const bytes = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="coursepulse-college-workbook-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
