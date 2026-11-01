import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createClient } from '@/lib/supabase/server';
import { aggregateExportRows, toCsv, type AggregateRow } from '@/lib/exports';
import { getCurrentUser, jsonError } from '@/lib/http';
import { attachQuestionCategories, isQuestionCategory, loadQuestionCategoryMap } from '@/lib/question-categories';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ format: string }> };

export async function GET(request: NextRequest, context: Context) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Exports are available to instructors and admins only.', 403);
  const { format } = await context.params;
  if (!['csv', 'xls', 'xlsx', 'pdf'].includes(format)) return jsonError('Unsupported export format.', 404);
  const params=request.nextUrl.searchParams;
  const courseId=params.get('course_id');
  const semesterId=params.get('semester_id');
  const departmentId=params.get('department_id');
  const fromDate=params.get('from_date');
  const toDate=params.get('to_date');
  const questionCategory=params.get('question_category');
  if(courseId&&!/^[0-9a-f-]{36}$/i.test(courseId)) return jsonError('Invalid course ID.');
  if(semesterId&&!/^[0-9a-f-]{36}$/i.test(semesterId)) return jsonError('Invalid semester ID.');
  if(departmentId&&!/^[0-9a-f-]{36}$/i.test(departmentId)) return jsonError('Invalid department ID.');
  if(questionCategory&&!isQuestionCategory(questionCategory)) return jsonError('Invalid question category.');
  const validDate=(value:string|null)=>{if(!value)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T00:00:00.000Z');return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;};
  if(!validDate(fromDate)||!validDate(toDate)) return jsonError('Dates must use YYYY-MM-DD format.');
  if(fromDate&&toDate&&fromDate>toDate) return jsonError('Start date must be on or before end date.');
  const { data, error } = await supabase.rpc('get_instructor_aggregates_filtered', { p_course_id: courseId, p_from_date: fromDate, p_to_date: toDate, p_semester_id: semesterId, p_department_id: departmentId });
  if (error) return jsonError('Could not prepare aggregate report.', 403);
  const aggregateRows=(data ?? []) as AggregateRow[];
  const {categories,error:categoryError}=await loadQuestionCategoryMap(supabase,aggregateRows.map(row=>row.feedback_id));
  if(categoryError) return jsonError('Could not load report question categories.',500);
  const categorizedRows=attachQuestionCategories(aggregateRows,categories);
  const filteredRows=questionCategory?categorizedRows.filter(row=>row.question_category===questionCategory):categorizedRows;
  const rows = aggregateExportRows(filteredRows);
  const date = new Date().toISOString().slice(0, 10);
  const common = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="coursepulse-aggregate-${date}.${format}"` };
  if (format === 'csv') return new NextResponse(toCsv(rows), { headers: { ...common, 'Content-Type': 'text/csv; charset=utf-8' } });
  if (format === 'xls') {
    const keys = rows.length ? Object.keys(rows[0]) : ['Notice'];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CoursePulse aggregate report</title></head><body><h1>CoursePulse aggregate report</h1><p>Generated ${date}. Groups under five responses are suppressed. Individual and written answers are not included.</p><table border="1"><thead><tr>${keys.map(k => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${keys.map(k => `<td>${escapeHtml(String(row[k as keyof typeof row] ?? ''))}</td>`).join('')}</tr>`).join('') : `<tr><td>No groups currently meet the minimum group size of five responses.</td></tr>`}</tbody></table></body></html>`;
    return new NextResponse(html, { headers: { ...common, 'Content-Type': 'application/vnd.ms-excel; charset=utf-8' } });
  }
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'CoursePulse'; workbook.created = new Date();
    const sheet = workbook.addWorksheet('Aggregate report');
    sheet.columns = rows.length ? Object.keys(rows[0]).map(key => ({ header: key, key, width: Math.min(48, Math.max(16, key.length + 4)) })) : [{ header: 'Notice', key: 'notice', width: 80 }];
    if (rows.length) sheet.addRows(rows); else sheet.addRow({ notice: 'No groups currently meet the minimum group size of five responses.' });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF193C34' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), { headers: { ...common, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
  }
  const pdf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: 'CoursePulse aggregate report', Author: 'CoursePulse' } });
    const chunks: Buffer[] = []; doc.on('data', chunk => chunks.push(Buffer.from(chunk))); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.fontSize(20).fillColor('#193c34').text('CoursePulse', { continued: true }).fontSize(10).fillColor('#72817b').text('   Aggregate feedback report');
    doc.moveDown(0.4).fontSize(9).fillColor('#64746e').text(`Generated ${date}  ·  Groups under five responses are suppressed  ·  Individual answers are not included`);
    doc.moveDown(1);
    if (!rows.length) doc.fontSize(11).fillColor('#253b34').text('No groups currently meet the minimum group size of five responses.');
    for (const row of rows) {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(11).fillColor('#193c34').text(String(row.Question));
      doc.fontSize(9).fillColor('#72817b').text(`${row.Course}  /  ${row.Feedback}  /  ${row.Category || 'Uncategorized'}  /  ${row.Type}`);
      const value = row['Average score'] !== '' ? `Average score: ${row['Average score']}` : `Responses: ${row['Responses (minimum 5)']}  ·  ${row['Answer option']}`;
      doc.fontSize(10).fillColor('#253b34').text(value); doc.moveDown(0.75);
    }
    doc.end();
  });
  return new NextResponse(new Uint8Array(pdf), { headers: { ...common, 'Content-Type': 'application/pdf' } });
}

function escapeHtml(value: string): string { return value.replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char)); }
