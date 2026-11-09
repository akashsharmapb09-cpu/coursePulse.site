import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const suggestionInput = z.object({
  category: z.enum(['INFRASTRUCTURE','CANTEEN','LIBRARY','TEACHING_QUALITY','LABS','OTHER']),
  title: z.string().trim().min(4).max(140),
  details: z.string().trim().min(10).max(4000),
  course_id: z.string().uuid().nullable().optional()
}).strict();

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'STUDENT') return jsonError('Student Voice is available to students only.', 403);

  const { data, error } = await supabase.from('student_suggestions')
    .select('id,category,title,details,course_id,status,resolution_note,created_at,updated_at')
    .eq('student_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return jsonError('Unable to load your suggestions.', 500);
  return NextResponse.json({ suggestions: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'STUDENT') return jsonError('Student Voice is available to students only.', 403);

  const protection = await protectMutation(request, supabase, 'feedback:create', 5, 3600);
  if (protection) return protection;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = suggestionInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid suggestion.');

  const { data, error } = await supabase.from('student_suggestions').insert({
    student_id: auth.user.id,
    category: parsed.data.category,
    title: parsed.data.title,
    details: parsed.data.details,
    course_id: parsed.data.course_id ?? null
  }).select('id,category,title,details,course_id,status,resolution_note,created_at,updated_at').single();

  if (error) {
    return jsonError(error.code === '42501'
      ? 'You may only attach a suggestion to a course you are enrolled in.'
      : 'Your suggestion could not be submitted.', error.code === '42501' ? 403 : 400);
  }
  return NextResponse.json({ suggestion: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
