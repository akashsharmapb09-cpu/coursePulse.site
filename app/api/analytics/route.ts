import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Analytics are available to instructors and admins only.', 403);
  const params=request.nextUrl.searchParams;
  const courseId=params.get('course_id');
  const semesterId=params.get('semester_id');
  const fromDate=params.get('from_date');
  const toDate=params.get('to_date');
  if(courseId&&!/^[0-9a-f-]{36}$/i.test(courseId)) return jsonError('Invalid course ID.');
  if(semesterId&&!/^[0-9a-f-]{36}$/i.test(semesterId)) return jsonError('Invalid semester ID.');
  const validDate=(value:string|null)=>!value||(/^\\d{4}-\\d{2}-\\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z')));
  if(!validDate(fromDate)||!validDate(toDate)) return jsonError('Dates must use YYYY-MM-DD format.');
  if(fromDate&&toDate&&fromDate>toDate) return jsonError('Start date must be on or before end date.');
  const { data, error } = await supabase.rpc('get_instructor_aggregates_filtered', { p_course_id: courseId, p_from_date: fromDate, p_to_date: toDate, p_semester_id: semesterId });
  if (error) return jsonError('Unable to load aggregate analytics.', 403);
  return NextResponse.json({ rows: data ?? [], minimum_group_size: 5, raw_answers_included: false }, { headers: { 'Cache-Control': 'no-store' } });
}
