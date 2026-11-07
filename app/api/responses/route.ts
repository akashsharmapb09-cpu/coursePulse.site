import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, consumeRateLimit } from '@/lib/http';
import { responseInput, questionSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'STUDENT') return jsonError('Only students can submit feedback.', 403);
  if (!await consumeRateLimit(supabase, 'responses:submit', 5, 60)) {
    return jsonError('Too many submissions. Please wait before trying again.', 429);
  }

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = responseInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid response.');

  // Validate the visible form schema in the request path, then let the database revalidate
  // eligibility, deadlines, duplicate prevention, question values and persistence atomically.
  const { data: form, error: formError } = await supabase.from('feedback')
    .select('id,form_schema,is_open,course_id').eq('id', parsed.data.feedback_id).single();
  if (formError || !form || !form.is_open) return jsonError('Feedback form is closed or unavailable.', 404);
  const questions = questionSchema.array().safeParse(form.form_schema);
  if (!questions.success) return jsonError('This form is not configured correctly.', 500);
  const expected = new Set(questions.data.map(q => q.id));
  if (Object.keys(parsed.data.answers).some(key => !expected.has(key))) return jsonError('Response contains unknown question fields.');

  const { error } = await supabase.rpc('submit_anonymous_feedback', {
    p_feedback_id: parsed.data.feedback_id,
    p_answers: parsed.data.answers
  });
  if (error?.code === '23505') return jsonError('You have already submitted feedback for this form.', 409);
  if (error?.code === '42501') return jsonError('You are not eligible to submit this feedback form.', 403);
  if (error?.code === 'P0002') return jsonError('This feedback form is closed or not assigned to your course.', 404);
  if (error?.code === '22023') return jsonError('One or more answers are invalid. Please review the form.', 400);
  if (error) return jsonError('Your anonymous response could not be submitted. Please try again.', 500);

  return NextResponse.json({ success: true, anonymous: true }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}
