export type AggregateRow = {
  course_id: string; course_title: string; feedback_id: string; feedback_title: string;
  question_id: string; question_label: string; question_type: string;
  option_value: string | null; response_count: number; avg_numeric_value: number | null; question_category?: string | null;
};

export type CourseReportSummary = {
  course_id: string;
  course_title: string;
  feedback_forms: number;
  reportable_responses: number;
  average_rating: number | null;
  rating_answers: number;
};

export function summarizeCourseReports(rows: AggregateRow[]): CourseReportSummary[] {
  const courses = new Map<string, {
    course_title: string;
    feedback: Map<string, number>;
    ratingTotal: number;
    ratingAnswers: number;
  }>();

  for (const row of rows) {
    const current = courses.get(row.course_id) ?? {
      course_title: row.course_title,
      feedback: new Map<string, number>(),
      ratingTotal: 0,
      ratingAnswers: 0
    };
    current.feedback.set(row.feedback_id, Math.max(current.feedback.get(row.feedback_id) ?? 0, Number(row.response_count) || 0));
    if (row.question_type === 'rating' && row.avg_numeric_value !== null) {
      const count = Number(row.response_count) || 0;
      const average = Number(row.avg_numeric_value);
      if (Number.isFinite(average) && count > 0) {
        current.ratingTotal += average * count;
        current.ratingAnswers += count;
      }
    }
    courses.set(row.course_id, current);
  }

  return Array.from(courses.entries()).map(([course_id, value]) => ({
    course_id,
    course_title: value.course_title,
    feedback_forms: value.feedback.size,
    reportable_responses: Array.from(value.feedback.values()).reduce((sum, count) => sum + count, 0),
    average_rating: value.ratingAnswers ? Number((value.ratingTotal / value.ratingAnswers).toFixed(2)) : null,
    rating_answers: value.ratingAnswers
  })).sort((a, b) => a.course_title.localeCompare(b.course_title));
}

export function spreadsheetSafeText(value: unknown): string {
  const text = value == null ? '' : String(value);
  // Spreadsheet applications may interpret formula-leading text as executable formulas.
  return /^[\\s]*[=+@-]/.test(text) ? "'" + text : text;
}

export function csvCell(value: unknown): string {
  const text = spreadsheetSafeText(value);
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
  if (!rows.length) return 'Course,Feedback,Question,Category,Type,Answer option,Responses (minimum 5),Average score\\r\\n';
  const keys = Object.keys(rows[0]);
  return [keys.map(csvCell).join(','), ...rows.map(row => keys.map(key => csvCell(row[key as keyof typeof row])).join(','))].join('\\r\\n');
}
