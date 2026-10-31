import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Analytics are available to instructors and admins only.', 403);
  const courseId = request.nextUrl.searchParams.get('course_id');
  if (courseId && !/^[0-9a-f-]{36}$/i.test(courseId)) return jsonError('Invalid course ID.');
  const { data, error } = await supabase.rpc('get_instructor_aggregates', { p_course_id: courseId });
  if (error) return jsonError('Unable to load aggregate analytics.', 403);
  return NextResponse.json({ rows: data ?? [], minimum_group_size: 5, raw_answers_included: false }, { headers: { 'Cache-Control': 'no-store' } });
}
