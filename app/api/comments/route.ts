import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkReadRateLimit, getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN','INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Instructor access is required.', 403);
  const rateLimit = await checkReadRateLimit(supabase, 'analytics:query', 30, 3600);
  if (rateLimit) return rateLimit;

  const params = request.nextUrl.searchParams;
  const courseId = params.get('course_id');
  const semesterId = params.get('semester_id');
  const fromDate = params.get('from_date');
  const toDate = params.get('to_date');
  const search = (params.get('q') ?? '').trim().slice(0, 100);
  const validUuid = (value: string | null) => !value || /^[0-9a-f-]{36}$/i.test(value);
  const validDate = (value: string | null) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!validUuid(courseId) || !validUuid(semesterId) || !validDate(fromDate) || !validDate(toDate) || (fromDate && toDate && fromDate > toDate)) {
    return jsonError('Invalid comment filters.');
  }

  const { data, error } = await supabase.rpc('get_filtered_anonymous_feedback', {
    p_course_id: courseId,
    p_semester_id: semesterId,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_search: search || null
  });
  if (error) return jsonError('Anonymous comments could not be loaded.', 403);
  type CommentProjectionRow = { id: string; feedback_id: string; course_id: string; created_at: string; comment: string; ratings_json: Record<string, number>; response_count: number };
  const rows = (data ?? []) as CommentProjectionRow[];
  const courseIds = [...new Set(rows.map(row => row.course_id))];
  const feedbackIds = [...new Set(rows.map(row => row.feedback_id))];
  const [coursesResult, feedbackResult] = await Promise.all([
    courseIds.length ? supabase.from('courses').select('id,course_code,title,semester_id,semester:semesters(name)').in('id', courseIds) : Promise.resolve({ data: [], error: null }),
    feedbackIds.length ? supabase.from('feedback').select('id,title').in('id', feedbackIds) : Promise.resolve({ data: [], error: null })
  ]);
  if (coursesResult.error || feedbackResult.error) return jsonError('Comment context could not be loaded.', 500);
  const courses = new Map((coursesResult.data ?? []).map(course => [course.id, course]));
  const forms = new Map((feedbackResult.data ?? []).map(form => [form.id, form]));
  const comments = rows.map(row => ({
    ...row,
    course: courses.get(row.course_id) ?? null,
    feedback: forms.get(row.feedback_id) ?? null
  }));
  return NextResponse.json({ comments, minimum_group_size: 5 }, { headers: { 'Cache-Control': 'no-store' } });
}
