import { describe, expect, it } from 'vitest';
import { csvCell, toCsv, aggregateExportRows, type AggregateRow } from '../lib/exports';

const sample: AggregateRow = {
  course_id: 'c1', course_title: 'Physics', feedback_id: 'f1', feedback_title: 'Module pulse',
  question_id: 'q1', question_label: 'Rate the module', question_type: 'rating',
  option_value: null, response_count: 8, avg_numeric_value: 4.25
};

describe('aggregate exports', () => {
  it('escapes quotes and CSV delimiters', () => expect(csvCell('a,"b"')).toBe('"a,""b"""'));
  it('neutralizes spreadsheet formulas', () => expect(csvCell('=HYPERLINK("x")')).toContain("'=HYPERLINK"));
  it('contains aggregate metrics, not response answer data', () => {
    const rows = aggregateExportRows([sample]);
    expect(rows[0]['Average score']).toBe(4.25);
    expect(JSON.stringify(rows)).not.toContain('student_id');
    expect(JSON.stringify(rows)).not.toContain('answers');
  });
  it('emits a deterministic header for empty results', () => expect(toCsv([])).toContain('Responses (minimum 5)'));
});
