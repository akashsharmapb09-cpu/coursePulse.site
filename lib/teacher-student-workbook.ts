import ExcelJS from 'exceljs';

export type TeacherStudentRow = {
  fullName: string;
  email: string;
  studentNumber: string;
  section: string;
  mobile: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^\+?[0-9 ()-]{8,24}$/;

function cellText(cell: ExcelJS.Cell, rowNumber: number, column: string): string {
  const value = cell.value as unknown;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    if ('formula' in item || 'sharedFormula' in item) {
      throw new Error('Students row ' + rowNumber + ': formulas are not allowed in ' + column + '. Enter a plain value.');
    }
    if ('hyperlink' in item) {
      throw new Error('Students row ' + rowNumber + ': hyperlinks are not allowed in ' + column + '.');
    }
    if (Array.isArray(item.richText)) {
      return item.richText.map((part) => {
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text);
        return '';
      }).join('').trim();
    }
    if (typeof item.text === 'string') return item.text.trim();
    throw new Error('Students row ' + rowNumber + ': ' + column + ' must contain plain text.');
  }
  return String(value).trim();
}

export async function parseTeacherStudentWorkbook(buffer: Buffer): Promise<TeacherStudentRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error('This is not a valid Excel .xlsx workbook. Download the CoursePulse student template and try again.');
  }

  const sheet = workbook.getWorksheet('Students');
  if (!sheet) throw new Error('The workbook must contain a worksheet named "Students".');

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const header = cellText(cell, 1, 'column ' + column).toLowerCase().replace(/[\s-]+/g, '_');
    if (!header) return;
    if (headers.has(header)) throw new Error('Students: duplicate column heading "' + header + '".');
    headers.set(header, column);
  });

  const required = ['full_name', 'email', 'student_number', 'section'];
  const missing = required.filter((header) => !headers.has(header));
  if (missing.length) throw new Error('Students: missing required columns: ' + missing.join(', ') + '.');
  if (sheet.rowCount < 2) throw new Error('Students: add at least one student row below the header.');

  const rows: TeacherStudentRow[] = [];
  const emails = new Set<string>();
  const rollNumbers = new Set<string>();
  let workbookSection = '';

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const get = (key: string) => {
      const column = headers.get(key);
      return column ? cellText(row.getCell(column), rowNumber, key) : '';
    };
    const fullName = get('full_name');
    const email = get('email').toLowerCase();
    const studentNumber = get('student_number');
    const section = get('section');
    const mobile = get('mobile');

    if (![fullName, email, studentNumber, section, mobile].some(Boolean)) continue;
    if (fullName.length < 2 || fullName.length > 120) {
      throw new Error('Students row ' + rowNumber + ': full_name must be 2–120 characters.');
    }
    if (!EMAIL.test(email) || email.length > 254) {
      throw new Error('Students row ' + rowNumber + ': enter a valid student email address.');
    }
    if (studentNumber.length < 1 || studentNumber.length > 40) {
      throw new Error('Students row ' + rowNumber + ': student_number is required and must be at most 40 characters.');
    }
    if (section.length < 1 || section.length > 30) {
      throw new Error('Students row ' + rowNumber + ': section is required and must be at most 30 characters.');
    }
    if (mobile && !MOBILE.test(mobile)) {
      throw new Error('Students row ' + rowNumber + ': enter a valid mobile number or leave it blank.');
    }
    if (emails.has(email)) throw new Error('Students row ' + rowNumber + ': duplicate email "' + email + '" in this workbook.');
    if (rollNumbers.has(studentNumber.toLowerCase())) {
      throw new Error('Students row ' + rowNumber + ': duplicate roll number "' + studentNumber + '" in this workbook.');
    }
    if (!workbookSection) workbookSection = section;
    else if (section.toLowerCase() !== workbookSection.toLowerCase()) {
      throw new Error('One workbook can contain only one section. Use a separate Excel file for each section.');
    }

    emails.add(email);
    rollNumbers.add(studentNumber.toLowerCase());
    rows.push({ fullName, email, studentNumber, section: workbookSection, mobile });
    if (rows.length > 100) throw new Error('A maximum of 100 students can be imported per workbook.');
  }

  if (!rows.length) throw new Error('Students: add at least one valid student row below the header.');
  return rows;
}
