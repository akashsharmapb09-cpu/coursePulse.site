import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';
import { responseInput, questionListSchema } from '@/lib/validation';
import { validateResponseAnswers } from '@/lib/response-validation';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const protection = await protectMutation(request, supabase, 'responses:submit', 5, 60);
  if (protection) return protection;
  if (auth.profile.role !== 'STUDENT') return jsonError('Only students can submit feedback.', 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = responseInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid response.');
  const { data: form, error: formError } = await supabase.from('feedback').select('id,form_schema,is_open,course_id').eq('id', parsed.data.feedback_id).single();
  if (formError || !form || !form.is_open) return jsonError('Feedback form is closed or unavailable.', 404);
  const questions = questionListSchema.safeParse(form.form_schema);
  if (!questions.success) return jsonError('This form is not configured correctly.', 500);
  const validationMessage = validateResponseAnswers(questions.data, parsed.data.answers);
  if (validationMessage) return jsonError(validationMessage);
  const { error } = await supabase.rpc('submit_anonymous_feedback', {
    p_feedback_id: form.id,
    p_answers: parsed.data.answers
  });
  if (error?.code === '23505') return jsonError('You have already submitted feedback for this form.', 409);
  if (error) return jsonError('Response could not be submitted.', error.code === '42501' ? 403 : 400);
  return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
