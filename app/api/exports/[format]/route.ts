import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createClient } from '@/lib/supabase/server';
import { aggregateExportRows, summarizeCourseReports, spreadsheetSafeText, toCsv, type AggregateRow } from '@/lib/exports';
import { checkReadRateLimit, getCurrentUser, jsonError } from '@/lib/http';
import { attachQuestionCategories, isQuestionCategory, loadQuestionCategoryMap } from '@/lib/question-categories';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ format: string }> };

type RatingDistributionRow = {
  course_id: string;
  course_title: string;
  feedback_id: string;
  feedback_title: string;
  question_id: string;
  question_label: string;
  rating_value: number;
  response_count: number;
  question_category?: string | null;
};

function safeDetailRows(rows: ReturnType<typeof aggregateExportRows>) {
  return rows.map(row => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? spreadsheetSafeText(value) : value])
  ));
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 28;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF193C34' } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (sheet.columnCount > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: 'top', wrapText: true };
      row.eachCell(cell => {
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE7EEE8' } } };
      });
    }
  });
  styleHeader(sheet.getRow(1));
}

function renderProfessionalPdf(
  summaries: ReturnType<typeof summarizeCourseReports>,
  distributions: RatingDistributionRow[],
  date: string,
  filters: string[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      bufferPages: true,
      info: { Title: 'CoursePulse Course Feedback Report', Author: 'CoursePulse', Subject: 'Anonymous aggregate course feedback analytics' }
    });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 88;
    const drawRule = (y: number) => {
      doc.moveTo(44, y).lineTo(pageWidth - 44, y).lineWidth(0.7).strokeColor('#dce7df').stroke();
    };
    const pageHeading = () => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#2c6a4b').text('COURSEPULSE  /  COURSE FEEDBACK REPORT', 44, 34, { characterSpacing: 0.7 });
      doc.font('Helvetica').fontSize(8).fillColor('#829087').text('CONFIDENTIAL · AGGREGATE DATA ONLY', 44, 49);
      drawRule(64);
      doc.y = 78;
    };
    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - 54) {
        doc.addPage();
        pageHeading();
      }
    };

    doc.font('Helvetica-Bold').fontSize(26).fillColor('#193c34').text('CoursePulse', 44, 40);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#557566').text('Course feedback report', 44, 76);
    doc.font('Helvetica').fontSize(9).fillColor('#7b8c82').text('Generated ' + date, 44, 97);
    if (filters.length) {
      doc.font('Helvetica').fontSize(8).fillColor('#63776c').text('Filters: ' + filters.join(' · '), 44, 112, { width: contentWidth });
    }
    drawRule(136);
    doc.y = 153;

    const totalCourses = summaries.length;
    const reportableForms = summaries.reduce((sum, item) => sum + item.feedback_forms, 0);
    const reportableResponses = summaries.reduce((sum, item) => sum + item.reportable_responses, 0);
    const ratingAnswers = summaries.reduce((sum, item) => sum + item.rating_answers, 0);
    const ratingTotal = summaries.reduce((sum, item) => sum + item.rating_answers * (item.average_rating ?? 0), 0);
    const overallRating = ratingAnswers ? (ratingTotal / ratingAnswers).toFixed(2) + ' / 5' : '—';

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#193c34').text('Report overview', 44, doc.y);
    doc.moveDown(0.8);
    const cards = [
      ['Courses', String(totalCourses)],
      ['Reportable forms', String(reportableForms)],
      ['Submissions', String(reportableResponses)],
      ['Average rating', overallRating]
    ];
    const cardGap = 9;
    const cardWidth = (contentWidth - cardGap * 3) / 4;
    const cardY = doc.y;
    cards.forEach(([label, value], index) => {
      const x = 44 + index * (cardWidth + cardGap);
      doc.roundedRect(x, cardY, cardWidth, 55, 7).fillAndStroke('#f1f6f2', '#dce8df');
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#245b40').text(value, x + 6, cardY + 10, { width: cardWidth - 12, align: 'center' });
      doc.font('Helvetica').fontSize(7).fillColor('#73847a').text(label, x + 5, cardY + 35, { width: cardWidth - 10, align: 'center' });
    });
    doc.y = cardY + 76;

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#193c34').text('Course-wise summary', 44, doc.y);
    doc.moveDown(0.65);
    const columns = [
      { title: 'Course', width: 265 },
      { title: 'Forms', width: 55 },
      { title: 'Responses', width: 78 },
      { title: 'Avg. rating', width: 71 }
    ];
    let y = doc.y;
    doc.rect(44, y, contentWidth, 23).fill('#193c34');
    let x = 52;
    for (const column of columns) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(column.title, x, y + 7, { width: column.width - 10 });
      x += column.width;
    }
    y += 23;
    if (!summaries.length) {
      doc.font('Helvetica').fontSize(9).fillColor('#75867c').text('No course currently has a reportable group of at least five submissions.', 52, y + 10);
      y += 36;
    }
    summaries.forEach((summary, index) => {
      const rowHeight = 30;
      if (y + rowHeight > doc.page.height - 55) {
        doc.addPage();
        pageHeading();
        y = doc.y;
      }
      if (index % 2 === 0) doc.rect(44, y, contentWidth, rowHeight).fill('#f5f8f5');
      const values = [
        summary.course_title,
        String(summary.feedback_forms),
        String(summary.reportable_responses),
        summary.average_rating == null ? '—' : summary.average_rating.toFixed(2) + ' / 5'
      ];
      x = 52;
      columns.forEach((column, columnIndex) => {
        doc.font('Helvetica').fontSize(8).fillColor('#304a3d').text(values[columnIndex], x, y + 9, { width: column.width - 10, ellipsis: true });
        x += column.width;
      });
      y += rowHeight;
    }
    doc.y = y + 15;

    const ratingCounts = new Map<string, number[]>();
    for (const item of distributions) {
      const counts = ratingCounts.get(item.course_id) ?? [0, 0, 0, 0, 0];
      if (item.rating_value >= 1 && item.rating_value <= 5) counts[item.rating_value - 1] += Number(item.response_count);
      ratingCounts.set(item.course_id, counts);
    }
    for (const summary of summaries) {
      const counts = ratingCounts.get(summary.course_id);
      if (!counts?.some(Boolean)) continue;
      ensureSpace(145);
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#193c34').text(summary.course_title + ' · Rating distribution');
      doc.moveDown(0.55);
      const max = Math.max(...counts, 1);
      counts.forEach((count, index) => {
        const rowY = doc.y;
        doc.font('Helvetica').fontSize(8).fillColor('#566d60').text(String(index + 1) + ' star', 48, rowY + 2, { width: 42 });
        const barX = 96;
        const barWidth = 320;
        doc.roundedRect(barX, rowY, barWidth, 11, 4).fill('#edf2ee');
        if (count > 0) doc.roundedRect(barX, rowY, Math.max(4, barWidth * count / max), 11, 4).fill('#3e805b');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#334f40').text(String(count), 426, rowY + 2, { width: 60, align: 'right' });
        doc.y = rowY + 19;
      });
      doc.moveDown(0.25);
    }

    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index);
      const footerY = doc.page.height - 31;
      drawRule(footerY - 7);
      doc.font('Helvetica').fontSize(7).fillColor('#8a978f')
        .text('Anonymous aggregate results only · Groups under five submissions are suppressed', 44, footerY, { width: contentWidth - 60 });
      doc.text('Page ' + (index + 1) + ' of ' + pages.count, pageWidth - 95, footerY, { width: 51, align: 'right' });
    }
    doc.end();
  });
}

export async function GET(request: NextRequest, context: Context) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Exports are available to instructors and admins only.', 403);
  if (auth.profile.role === 'ADMIN') {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== 'aal2') return jsonError('Complete administrator multi-factor authentication before using this report.', 403);
  }
  const rateLimit = await checkReadRateLimit(supabase, 'exports:download', 20, 3600);
  if (rateLimit) return rateLimit;
  const { format } = await context.params;
  if (!['csv', 'xls', 'xlsx', 'pdf'].includes(format)) return jsonError('Unsupported export format.', 404);

  const params = request.nextUrl.searchParams;
  const courseId = params.get('course_id');
  const semesterId = params.get('semester_id');
  const departmentId = params.get('department_id');
  const fromDate = params.get('from_date');
  const toDate = params.get('to_date');
  const questionCategory = params.get('question_category');
  if (courseId && !/^[0-9a-f-]{36}$/i.test(courseId)) return jsonError('Invalid course ID.');
  if (semesterId && !/^[0-9a-f-]{36}$/i.test(semesterId)) return jsonError('Invalid semester ID.');
  if (departmentId && !/^[0-9a-f-]{36}$/i.test(departmentId)) return jsonError('Invalid department ID.');
  if (questionCategory && !isQuestionCategory(questionCategory)) return jsonError('Invalid question category.');

  const validDate = (value: string | null) => {
    if (!value) return true;
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(fromDate) || !validDate(toDate)) return jsonError('Dates must use YYYY-MM-DD format.');
  if (fromDate && toDate && fromDate > toDate) return jsonError('Start date must be on or before end date.');

  const rpcArgs = {
    p_course_id: courseId,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_semester_id: semesterId,
    p_department_id: departmentId
  };
  const [aggregateResult, ratingResult] = await Promise.all([
    supabase.rpc('get_instructor_aggregates_filtered', rpcArgs),
    supabase.rpc('get_instructor_rating_distribution_filtered', rpcArgs)
  ]);
  if (aggregateResult.error || ratingResult.error) return jsonError('Could not prepare aggregate report.', 403);

  const aggregateRows = (aggregateResult.data ?? []) as AggregateRow[];
  const rawRatings = (ratingResult.data ?? []) as RatingDistributionRow[];
  const feedbackIds = [...aggregateRows, ...rawRatings].map(row => row.feedback_id);
  const { categories, error: categoryError } = await loadQuestionCategoryMap(supabase, feedbackIds);
  if (categoryError) return jsonError('Could not load report question categories.', 500);

  const categorizedRows = attachQuestionCategories(aggregateRows, categories) as AggregateRow[];
  const categorizedRatings = attachQuestionCategories(rawRatings, categories) as RatingDistributionRow[];
  const filteredRows = questionCategory ? categorizedRows.filter(row => row.question_category === questionCategory) : categorizedRows;
  const filteredRatings = questionCategory ? categorizedRatings.filter(row => row.question_category === questionCategory) : categorizedRatings;
  const rows = aggregateExportRows(filteredRows);
  const summaries = summarizeCourseReports(filteredRows);
  const date = new Date().toISOString().slice(0, 10);
  const common = {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `attachment; filename="coursepulse-course-feedback-${date}.${format}"`
  };
  if (format === 'csv') return new NextResponse(toCsv(rows), { headers: { ...common, 'Content-Type': 'text/csv; charset=utf-8' } });

  if (format === 'xls') {
    const keys = rows.length ? Object.keys(rows[0]) : ['Notice'];
    const safeRows = safeDetailRows(rows);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CoursePulse course feedback report</title></head><body><h1>CoursePulse course feedback report</h1><p>Generated ${date}. Groups under five responses are suppressed. Student identities and individual answers are not included.</p><table border="1"><thead><tr>${keys.map(key => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead><tbody>${safeRows.length ? safeRows.map(row => `<tr>${keys.map(key => `<td>${escapeHtml(String(row[key] ?? ''))}</td>`).join('')}</tr>`).join('') : '<tr><td>No groups meet the minimum report size.</td></tr>'}</tbody></table></body></html>`;
    return new NextResponse(html, { headers: { ...common, 'Content-Type': 'application/vnd.ms-excel; charset=utf-8' } });
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CoursePulse';
    workbook.subject = 'Anonymous aggregate course feedback';
    workbook.title = 'CoursePulse Course Feedback Report';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Course summary');
    summarySheet.columns = [
      { header: 'Course', key: 'Course', width: 38 },
      { header: 'Reportable feedback forms', key: 'Reportable feedback forms', width: 27 },
      { header: 'Reportable submissions', key: 'Reportable submissions', width: 24 },
      { header: 'Average rating (1–5)', key: 'Average rating (1–5)', width: 22 },
      { header: 'Rating answers included', key: 'Rating answers included', width: 23 }
    ];
    const summaryRows = summaries.map(item => ({
      Course: spreadsheetSafeText(item.course_title),
      'Reportable feedback forms': item.feedback_forms,
      'Reportable submissions': item.reportable_responses,
      'Average rating (1–5)': item.average_rating ?? '',
      'Rating answers included': item.rating_answers
    }));
    if (summaryRows.length) summarySheet.addRows(summaryRows);
    else summarySheet.addRow({ Course: 'No reportable groups yet' });

    const ratingSheet = workbook.addWorksheet('Rating distribution');
    ratingSheet.columns = [
      { header: 'Course', key: 'Course', width: 34 },
      { header: 'Feedback form', key: 'Feedback form', width: 32 },
      { header: 'Question', key: 'Question', width: 48 },
      { header: 'Category', key: 'Category', width: 24 },
      { header: 'Rating', key: 'Rating', width: 12 },
      { header: 'Responses (minimum 5)', key: 'Responses (minimum 5)', width: 25 }
    ];
    ratingSheet.addRows(filteredRatings.map(item => ({
      Course: spreadsheetSafeText(item.course_title),
      'Feedback form': spreadsheetSafeText(item.feedback_title),
      Question: spreadsheetSafeText(item.question_label),
      Category: spreadsheetSafeText(item.question_category ?? ''),
      Rating: item.rating_value,
      'Responses (minimum 5)': Number(item.response_count)
    })));

    const detailSheet = workbook.addWorksheet('Question details');
    detailSheet.columns = rows.length
      ? Object.keys(rows[0]).map(key => ({ header: key, key, width: Math.min(48, Math.max(16, key.length + 5)) }))
      : [{ header: 'Notice', key: 'Notice', width: 72 }];
    if (rows.length) detailSheet.addRows(safeDetailRows(rows));
    else detailSheet.addRow({ Notice: 'No groups currently meet the minimum group size of five responses.' });

    [summarySheet, ratingSheet, detailSheet].forEach(styleSheet);
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: { ...common, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    });
  }

  const filterLabels = [
    courseId ? 'Selected course' : '',
    semesterId ? 'Selected semester' : '',
    departmentId ? 'Selected department' : '',
    fromDate ? 'From ' + fromDate : '',
    toDate ? 'To ' + toDate : '',
    questionCategory || ''
  ].filter(Boolean);
  const pdf = await renderProfessionalPdf(summaries, filteredRatings, date, filterLabels);
  return new NextResponse(new Uint8Array(pdf), { headers: { ...common, 'Content-Type': 'application/pdf' } });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character] ?? character));
}
