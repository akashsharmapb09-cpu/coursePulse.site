import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { feedbackInput } from '@/lib/validation';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const id = request.nextUrl.searchParams.get('id');
  let query = supabase.from('feedback').select('id,course_id,title,description,form_schema,is_open,created_at,retention_days').order('created_at', { ascending: false });
  if (id) query = query.eq('id', id);
  const { data, error } = await query;
  if (error) return jsonError('Unable to load feedback forms.', 500);
  return NextResponse.json(id ? { feedback: data?.[0] ?? null } : { feedback: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const protection = await protectMutation(request, supabase, 'feedback:create', 10, 3600);
  if (protection) return protection;
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Only instructors and admins can create feedback forms.', 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = feedbackInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid feedback form.');
  const { data: course, error: courseError } = await supabase.from('courses').select('id').eq('id', parsed.data.course_id).single();
  if (courseError || !course) return jsonError('Course not found or not accessible.', 404);
  const { data, error } = await supabase.from('feedback').insert({
    course_id: parsed.data.course_id, created_by: auth.user.id,
    title: parsed.data.title, description: parsed.data.description,
    form_schema: parsed.data.form_schema, retention_days: parsed.data.retention_days, is_open: true
  }).select('id,course_id,title,description,is_open,created_at').single();
  if (error) return jsonError('Feedback form could not be created. Check course ownership.', 403);
  return NextResponse.json({ feedback: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
