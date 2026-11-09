import ExcelJS from 'exceljs';
import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Sign in with your teacher account to download the student template.', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Assigned teacher access is required.', 403);

  const courseId = request.nextUrl.searchParams.get('course_id') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)) {
    return jsonError('Choose an assigned course before downloading the template.');
  }

  const { error } = await supabase.rpc('get_instructor_students', { p_course_id: courseId });
  if (error?.code === '42501') return jsonError('You are not assigned to this course.', 403);
  if (error) return jsonError('Course assignment could not be verified.', 500);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CoursePulse';
  workbook.subject = 'Teacher student roster import';
  workbook.title = 'CoursePulse Student Roster Workbook';

  const guide = workbook.addWorksheet('Instructions');
  guide.columns = [{ width: 26 }, { width: 78 }, { width: 42 }];
  guide.mergeCells('A1:C1');
  guide.getCell('A1').value = 'CoursePulse · Student Roster Import';
  guide.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF173F30' } };
  guide.getRow(1).height = 32;
  guide.addRow(['Field', 'What to enter', 'Example']);
  guide.getRow(2).eachCell((cell) => { cell.style = headerStyle; });
  guide.addRows([
    ['full_name', 'Student’s full name (required).', 'Aarav Sharma'],
    ['mobile', 'Student mobile number is required. Use +country code; Indian 10-digit values are normalized to +91.', '+919876543210'],
    ['student_number', 'College roll/enrolment number (required). Keep it as text to preserve leading zeroes.', 'CSE-2026-001'],
    ['section', 'Section name (required). Every row in one workbook must use the same section.', 'A'],
    
    ['Course selection', 'Choose the assigned course in the Teacher Console before uploading this file.', 'CS101 · Programming'],
    ['One section per file', 'Do not mix sections in one workbook. Download/upload a separate workbook for each section.', 'Section A, then Section B'],
    ['Limits', 'Maximum 100 students and 4 MB per workbook. Keep the worksheet name and column headings unchanged.', ''],
    ['Account security', 'Students create accounts with their mobile numbers and verify using an SMS OTP. Teachers cannot view or set passwords.', ''],
  ]);
  guide.getColumn(1).font = { bold: true, color: { argb: 'FF27533E' } };
  guide.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  guide.getColumn(3).alignment = { wrapText: true, vertical: 'top' };
  guide.eachRow((row, rowNumber) => { if (rowNumber > 2) row.height = 34; });

  const students = workbook.addWorksheet('Students');
  students.columns = [
    { header: 'full_name', key: 'full_name', width: 32 },
    { header: 'mobile', key: 'mobile', width: 24 },
    { header: 'student_number', key: 'student_number', width: 24 },
    { header: 'section', key: 'section', width: 16 },
  ];
  const header = students.getRow(1);
  header.height = 26;
  header.eachCell((cell) => { cell.style = headerStyle; });
  students.views = [{ state: 'frozen', ySplit: 1 }];
  students.autoFilter = { from: 'A1', to: 'E1' };
  students.getColumn(3).numFmt = '@';
  students.getColumn(5).numFmt = '@';

  const bytes = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="coursepulse-student-roster-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
