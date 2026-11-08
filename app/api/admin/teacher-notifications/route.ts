import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  from_date: z.string().date(),
  to_date: z.string().date(),
  threshold: z.coerce.number().min(1).max(5),
  minimum_responses: z.number().int().min(5).max(100).default(10)
}).strict();

type AggregateRow = {
  course_id: string;
  feedback_id: string;
  question_type: string;
  avg_numeric_value: number | string | null;
  response_count: number | string;
};

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('College Head administrator MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('College Head access is required.', 403);

  const { data, error } = await supabase.from('monthly_report_settings')
    .select('rating_threshold,minimum_responses,updated_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) return jsonError('Monthly report settings could not be loaded.', 500);
  return NextResponse.json({
    settings: data ?? { rating_threshold: 3, minimum_responses: 10 }
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('College Head administrator MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('College Head access is required.', 403);

  const protection = await protectMutation(request, supabase, 'admin:user-update', 20, 3600);
  if (protection) return protection;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success || parsed.data.from_date > parsed.data.to_date) return jsonError('Choose a valid reporting period and review threshold.');

  const { error: settingsError } = await supabase.from('monthly_report_settings').upsert({
    id: 1,
    rating_threshold: parsed.data.threshold,
    minimum_responses: parsed.data.minimum_responses,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });
  if (settingsError) return jsonError('Monthly review thresholds could not be saved.', 500);

  const { data: aggregates, error: aggregateError } = await supabase.rpc('get_instructor_aggregates_filtered', {
    p_course_id: null,
    p_from_date: parsed.data.from_date,
    p_to_date: parsed.data.to_date,
    p_semester_id: null,
    p_department_id: null
  });
  if (aggregateError) return jsonError('Unable to calculate private teacher review thresholds.', 403);

  const { data: courses, error: courseError } = await supabase.from('courses')
    .select('id,instructor_id')
    .limit(2000);
  if (courseError) return jsonError('Unable to resolve course assignments for teacher review.', 500);

  const courseTeacher = new Map((courses ?? []).map(course => [course.id, course.instructor_id]));
  const forms = new Map<string, { course_id: string; scoreTotal: number; questionCount: number; responses: number }>();
  for (const row of (aggregates ?? []) as AggregateRow[]) {
    if (row.question_type !== 'rating' || row.avg_numeric_value === null) continue;
    const score = Number(row.avg_numeric_value);
    const responseCount = Number(row.response_count);
    if (!Number.isFinite(score) || !Number.isFinite(responseCount) || responseCount < 5) continue;
    const key = row.course_id + ':' + row.feedback_id;
    const current = forms.get(key) ?? { course_id: row.course_id, scoreTotal: 0, questionCount: 0, responses: 0 };
    current.scoreTotal += score;
    current.questionCount += 1;
    current.responses = Math.max(current.responses, responseCount);
    forms.set(key, current);
  }

  const teachers = new Map<string, { scoreTotal: number; responses: number }>();
  for (const form of forms.values()) {
    if (!form.questionCount || !form.responses) continue;
    const instructorId = courseTeacher.get(form.course_id);
    if (!instructorId) continue;
    const metric = teachers.get(instructorId) ?? { scoreTotal: 0, responses: 0 };
    metric.scoreTotal += (form.scoreTotal / form.questionCount) * form.responses;
    metric.responses += form.responses;
    teachers.set(instructorId, metric);
  }

  const periodStart = parsed.data.from_date.slice(0, 7) + '-01';
  const messages = [...teachers.entries()]
    .filter(([, value]) => value.responses >= parsed.data.minimum_responses && value.scoreTotal / value.responses < parsed.data.threshold)
    .map(([recipientId]) => ({
      recipient_id: recipientId,
      created_by: auth.user.id,
      category: 'PERFORMANCE_REVIEW',
      period_start: periodStart,
      title: 'Private teaching feedback review',
      body: 'Please meet the College Head for a confidential discussion about recent course feedback and possible teaching support. This is a supportive review request, not a disciplinary finding. The office will coordinate a suitable time with you.'
    }));

  if (!messages.length) return NextResponse.json({ created: 0, eligible_teachers: 0 }, { headers: { 'Cache-Control': 'no-store' } });

  const { data, error } = await supabase.from('teacher_notifications')
    .upsert(messages, { onConflict: 'recipient_id,category,period_start', ignoreDuplicates: true })
    .select('id');
  if (error) return jsonError('Teacher notifications could not be created.', 500);

  return NextResponse.json({
    created: data?.length ?? 0,
    eligible_teachers: messages.length,
    duplicate_suppressed: messages.length - (data?.length ?? 0)
  }, { headers: { 'Cache-Control': 'no-store' } });
}
