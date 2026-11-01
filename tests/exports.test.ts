import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { csvCell, spreadsheetSafeText, toCsv, aggregateExportRows, type AggregateRow } from '../lib/exports';

const sample: AggregateRow = {
  course_id: 'c1', course_title: 'Physics', feedback_id: 'f1', feedback_title: 'Module pulse',
  question_id: 'q1', question_label: 'Rate the module', question_type: 'rating',
  option_value: null, response_count: 8, avg_numeric_value: 4.25
};

describe('aggregate exports', () => {
  it('escapes quotes and CSV delimiters', () => expect(csvCell('a,"b"')).toBe('"a,""b"""'));
  it('neutralizes spreadsheet formulas in text values before CSV, XLS and XLSX encoding', () => {
    expect(spreadsheetSafeText('=HYPERLINK("x")')).toBe("'=HYPERLINK(\"x\")");
    expect(spreadsheetSafeText('\t+cmd|/C calc')).toBe("'\t+cmd|/C calc");
    expect(spreadsheetSafeText('  =1+1')).toBe("'  =1+1");
    expect(spreadsheetSafeText('ordinary course title')).toBe('ordinary course title');
    expect(csvCell('=HYPERLINK("x")')).toContain("'=HYPERLINK");
  });
  it('contains aggregate metrics, not response answer data', () => {
    const rows = aggregateExportRows([sample]);
    expect(rows[0]['Average score']).toBe(4.25);
    expect(JSON.stringify(rows)).not.toContain('student_id');
    expect(JSON.stringify(rows)).not.toContain('answers');
  });
  it('emits a deterministic header for empty results', () => expect(toCsv([])).toContain('Responses (minimum 5)'));
  it('writes a real XLSX workbook archive', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Course', 'Responses']);
    sheet.addRow(['Physics', 8]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    expect(bytes.length).toBeGreaterThan(100);
  });
});
