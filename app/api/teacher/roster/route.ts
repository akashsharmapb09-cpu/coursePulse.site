import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Sign in to view your assigned classes.', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Assigned teacher access is required.', 403);

  const courseId = request.nextUrl.searchParams.get('course_id') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)) {
    return jsonError('Choose one of your assigned courses.');
  }

  const { data, error } = await supabase.rpc('get_instructor_students', { p_course_id: courseId });
  if (error?.code === '42501') return jsonError('You are not assigned to this course.', 403);
  if (error) return jsonError('The class roster could not be loaded.', 500);
  return NextResponse.json({ students: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
