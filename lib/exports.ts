export type AggregateRow = {
  course_id: string; course_title: string; feedback_id: string; feedback_title: string;
  question_id: string; question_label: string; question_type: string;
  option_value: string | null; response_count: number; avg_numeric_value: number | null; question_category?: string | null;
};

export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Prevent spreadsheet formula injection on exported text fields.
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function aggregateExportRows(rows: AggregateRow[]) {
  return rows.map(row => ({
    Course: row.course_title,
    Feedback: row.feedback_title,
    Question: row.question_label,
    Category: row.question_category ?? '',
    Type: row.question_type,
    'Answer option': row.option_value ?? (row.avg_numeric_value == null ? 'Summary' : 'Average'),
    'Responses (minimum 5)': Number(row.response_count),
    'Average score': row.avg_numeric_value == null ? '' : Number(Number(row.avg_numeric_value).toFixed(2))
  }));
}

export function toCsv(rows: ReturnType<typeof aggregateExportRows>): string {
  if (!rows.length) return 'Course,Feedback,Question,Category,Type,Answer option,Responses (minimum 5),Average score\r\n';
  const keys = Object.keys(rows[0]);
  return [keys.map(csvCell).join(','), ...rows.map(row => keys.map(key => csvCell(row[key as keyof typeof row])).join(','))].join('\r\n');
}
