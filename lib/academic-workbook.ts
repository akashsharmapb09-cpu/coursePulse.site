import ExcelJS from 'exceljs';

export type WorkbookDepartment = { code: string; name: string };
export type WorkbookCourse = {
  code: string;
  title: string;
  departmentCode: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED';
};
export type WorkbookTeacher = {
  fullName: string;
  mobile: string;
  departmentCode: string;
  courseCodes: string[];
};
export type AcademicWorkbook = {
  departments: WorkbookDepartment[];
  courses: WorkbookCourse[];
  teachers: WorkbookTeacher[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEPARTMENT_CODE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;
const COURSE_CODE = /^[A-Z0-9][A-Z0-9._-]{1,29}$/;

function readCell(cell: ExcelJS.Cell, sheet: string, row: number, column: string): string {
  const value = cell.value as unknown;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    if ('formula' in item || 'sharedFormula' in item) {
      throw new Error(sheet + ' row ' + row + ': formulas are not allowed in ' + column + '. Enter a plain value.');
    }
    if ('hyperlink' in item) {
      throw new Error(sheet + ' row ' + row + ': hyperlinks are not allowed in ' + column + '.');
    }
    if (Array.isArray(item.richText)) {
      return item.richText.map((part) => {
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text);
        return '';
      }).join('').trim();
    }
    if (typeof item.text === 'string') return item.text.trim();
    throw new Error(sheet + ' row ' + row + ': ' + column + ' must contain plain text.');
  }
  return String(value).trim();
}

function rowsFromSheet(
  workbook: ExcelJS.Workbook,
  sheetName: 'Departments' | 'Courses' | 'Teachers',
  requiredHeaders: string[],
  maxRows: number
): Record<string, string>[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error('Missing "' + sheetName + '" worksheet. Download the CoursePulse Excel template and keep all three sheets.');
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const header = readCell(cell, sheetName, 1, 'column ' + column).toLowerCase().replace(/[\s-]+/g, '_');
    if (!header) return;
    if (headers.has(header)) throw new Error(sheetName + ': duplicate column heading "' + header + '".');
    headers.set(header, column);
  });
  const missing = requiredHeaders.filter((header) => !headers.has(header));
  if (missing.length) throw new Error(sheetName + ': missing required columns: ' + missing.join(', ') + '.');
  const output: Record<string, string>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const item: Record<string, string> = {};
    for (const header of requiredHeaders) {
      const column = headers.get(header);
      item[header] = column ? readCell(row.getCell(column), sheetName, rowNumber, header) : '';
    }
    if (Object.values(item).every((value) => value.length === 0)) continue;
    output.push(item);
    if (output.length > maxRows) throw new Error(sheetName + ': maximum ' + maxRows + ' non-empty rows allowed.');
  }
  if (!output.length) throw new Error(sheetName + ': add at least one data row below the header.');
  return output;
}

function code(value: string, label: string, expression: RegExp): string {
  const normalized = value.trim().toUpperCase();
  const maximum = label === 'Department code' ? 20 : 30;
  if (!expression.test(normalized)) {
    throw new Error(label + ' "' + value + '" is invalid. Use 2–' + maximum + ' letters, numbers, dots, underscores or hyphens as applicable.');
  }
  return normalized;
}

export async function parseAcademicWorkbook(buffer: Buffer): Promise<AcademicWorkbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error('This file is not a valid Excel .xlsx workbook. Download the CoursePulse template and try again.');
  }

  const departmentRows = rowsFromSheet(workbook, 'Departments', ['department_code', 'department_name'], 200);
  const courseRows = rowsFromSheet(workbook, 'Courses', ['course_code', 'course_name', 'department_code', 'description', 'status'], 500);
  const teacherRows = rowsFromSheet(workbook, 'Teachers', ['teacher_name', 'mobile', 'department_code', 'course_codes'], 100);

  const departments: WorkbookDepartment[] = [];
  const departmentCodes = new Set<string>();
  const departmentNames = new Set<string>();
  for (let index = 0; index < departmentRows.length; index += 1) {
    const row = departmentRows[index];
    const codeValue = code(row.department_code, 'Departments row ' + (index + 2) + ' code', DEPARTMENT_CODE);
    const name = row.department_name.trim();
    if (name.length < 2 || name.length > 120) throw new Error('Departments row ' + (index + 2) + ': department_name must be 2–120 characters.');
    if (departmentCodes.has(codeValue)) throw new Error('Departments row ' + (index + 2) + ': duplicate department_code "' + codeValue + '".');
    if (departmentNames.has(name.toLowerCase())) throw new Error('Departments row ' + (index + 2) + ': duplicate department_name "' + name + '".');
    departmentCodes.add(codeValue);
    departmentNames.add(name.toLowerCase());
    departments.push({ code: codeValue, name });
  }

  const courses: WorkbookCourse[] = [];
  const courseCodes = new Set<string>();
  for (let index = 0; index < courseRows.length; index += 1) {
    const row = courseRows[index];
    const courseCode = code(row.course_code, 'Courses row ' + (index + 2) + ' course_code', COURSE_CODE);
    const title = row.course_name.trim();
    const departmentCode = code(row.department_code, 'Courses row ' + (index + 2) + ' department_code', DEPARTMENT_CODE);
    const description = row.description.trim();
    const statusValue = (row.status || 'DRAFT').trim().toUpperCase();
    if (title.length < 2 || title.length > 160) throw new Error('Courses row ' + (index + 2) + ': course_name must be 2–160 characters.');
    if (description.length > 5000) throw new Error('Courses row ' + (index + 2) + ': description cannot exceed 5,000 characters.');
    if (statusValue !== 'DRAFT' && statusValue !== 'PUBLISHED') throw new Error('Courses row ' + (index + 2) + ': status must be DRAFT or PUBLISHED.');
    if (courseCodes.has(courseCode)) throw new Error('Courses row ' + (index + 2) + ': duplicate course_code "' + courseCode + '".');
    courseCodes.add(courseCode);
    courses.push({ code: courseCode, title, departmentCode, description, status: statusValue });
  }

  const teachers: WorkbookTeacher[] = [];
  const teacherMobiles = new Set<string>();
  for (let index = 0; index < teacherRows.length; index += 1) {
    const row = teacherRows[index];
    const fullName = row.teacher_name.trim();
    const rawMobile = row.mobile.trim().replace(/[\s()-]/g, '');
    const mobile = /^\d{10}$/.test(rawMobile) ? '+91' + rawMobile : /^91\d{10}$/.test(rawMobile) ? '+' + rawMobile : rawMobile;
    const departmentCode = code(row.department_code, 'Teachers row ' + (index + 2) + ' department_code', DEPARTMENT_CODE);
    const courseCodesForTeacher = row.course_codes.split(';').map((item) => item.trim()).filter(Boolean)
      .map((item) => code(item, 'Teachers row ' + (index + 2) + ' course_codes', COURSE_CODE));
    if (fullName.length < 2 || fullName.length > 120) throw new Error('Teachers row ' + (index + 2) + ': teacher_name must be 2–120 characters.');
    if (!MOBILE.test(mobile)) throw new Error('Teachers row ' + (index + 2) + ': enter a valid mobile number with country code.');
    if (teacherMobiles.has(mobile)) throw new Error('Teachers row ' + (index + 2) + ': duplicate mobile number "' + mobile + '".');
    if (!courseCodesForTeacher.length || courseCodesForTeacher.length > 25) {
      throw new Error('Teachers row ' + (index + 2) + ': add 1–25 course codes separated by semicolons.');
    }
    if (new Set(courseCodesForTeacher).size !== courseCodesForTeacher.length) {
      throw new Error('Teachers row ' + (index + 2) + ': a course code is repeated.');
    }
    teacherMobiles.add(mobile);
    teachers.push({ fullName, mobile, departmentCode, courseCodes: courseCodesForTeacher });
  }

  return { departments, courses, teachers };
}
