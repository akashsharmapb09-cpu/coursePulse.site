import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';
import { responseInput, questionSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'STUDENT') return jsonError('Only students can submit feedback.', 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = responseInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid response.');
  const { data: form, error: formError } = await supabase.from('feedback').select('id,form_schema,is_open,course_id').eq('id', parsed.data.feedback_id).single();
  if (formError || !form || !form.is_open) return jsonError('Feedback form is closed or unavailable.', 404);
  const questions = questionSchema.array().safeParse(form.form_schema);
  if (!questions.success) return jsonError('This form is not configured correctly.', 500);
  const expected = new Set(questions.data.map(q => q.id));
  if (Object.keys(parsed.data.answers).some(key => !expected.has(key))) return jsonError('Response contains unknown question fields.');
  for (const q of questions.data) {
    const value = parsed.data.answers[q.id];
    if (value === undefined || value === null || value === '') {
      if (q.required) return jsonError(`Please answer: ${q.label}`);
      continue;
    }
    if (q.type === 'rating' && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5)) return jsonError('Ratings must be a whole number from 1 to 5.');
    if (q.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1000000)) return jsonError('Numeric answer is invalid.');
    if (['text', 'textarea'].includes(q.type) && (typeof value !== 'string' || value.length > 2000)) return jsonError('Written answers must be 2,000 characters or fewer.');
    if (q.type === 'single_choice' && (typeof value !== 'string' || !q.options?.includes(value))) return jsonError('Please choose a valid option.');
    if (q.type === 'multiple_choice' && (!Array.isArray(value) || (q.required && value.length === 0) || value.length > 20 || value.some(v => typeof v !== 'string' || !q.options?.includes(v)))) return jsonError('Please choose valid options.');
  }
  const { error } = await supabase.from('responses').insert({ feedback_id: form.id, student_id: auth.user.id, answers: parsed.data.answers });
  if (error?.code === '23505') return jsonError('You have already submitted feedback for this form.', 409);
  if (error) return jsonError('Response could not be submitted.', 403);
  return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
