import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { courseInput } from '@/lib/validation';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const query = supabase.from('courses').select('id,title,description,status,created_at,instructor_id').order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return jsonError('Unable to load courses.', 500);
  return NextResponse.json({ courses: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Only instructors and admins can create courses.', 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = courseInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid course details.');
  const { data, error } = await supabase.from('courses').insert({
    instructor_id: auth.user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    status: 'PUBLISHED'
  }).select('id,title,description,status,created_at,instructor_id').single();
  if (error) return jsonError('Course could not be created. Check your role and try again.', 403);
  return NextResponse.json({ course: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
