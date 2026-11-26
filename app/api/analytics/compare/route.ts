import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkReadRateLimit, getCurrentUser, jsonError } from '@/lib/http';
import { attachQuestionCategories, loadQuestionCategoryMap } from '@/lib/question-categories';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN','INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Instructor access is required.', 403);
  const rateLimit = await checkReadRateLimit(supabase, 'analytics:query', 30, 3600);
  if (rateLimit) return rateLimit;

  const params = request.nextUrl.searchParams;
  const courseIds = [...new Set((params.get('course_ids') ?? '').split(',').map(value => value.trim()).filter(Boolean))];
  if (courseIds.length < 2 || courseIds.length > 8 || courseIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) {
    return jsonError('Choose between two and eight courses to compare.');
  }
  const fromDate = params.get('from_date');
  const toDate = params.get('to_date');
  const semesterId = params.get('semester_id');
  const validDate = (value: string | null) => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(fromDate) || !validDate(toDate) || (fromDate && toDate && fromDate > toDate)) return jsonError('Invalid comparison date range.');
  if (semesterId && !/^[0-9a-f-]{36}$/i.test(semesterId)) return jsonError('Invalid semester ID.');

  const { data: courses, error: coursesError } = await supabase.from('courses')
    .select('id,course_code,title,semester_id,semester:semesters(name)')
    .in('id', courseIds)
    .order('title');
  if (coursesError || (courses?.length ?? 0) !== courseIds.length) return jsonError('One or more courses are unavailable to this instructor.', 403);

  const { data: instructorNames, error: instructorError } = await supabase.rpc('get_course_instructor_names', { p_course_ids: courseIds });
  if (instructorError) return jsonError('Instructor comparison details are unavailable.', 500);
  const instructorByCourse = new Map((instructorNames ?? []).map((row: {course_id:string;instructor_name:string}) => [row.course_id, row.instructor_name]));

  const results = await Promise.all(courseIds.map(async courseId => {
    const args = {
      p_course_id: courseId,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_semester_id: semesterId,
      p_department_id: null
    };
    const [aggregate, submissions] = await Promise.all([
      supabase.rpc('get_instructor_aggregates_filtered', args),
      supabase.rpc('get_filtered_anonymous_feedback', {
        p_course_id: courseId,
        p_semester_id: semesterId,
        p_from_date: fromDate,
        p_to_date: toDate,
        p_search: null
      })
    ]);
    if (aggregate.error) throw new Error('Course analytics are unavailable.');
    if (submissions.error) throw new Error('Submission counts are unavailable.');
    const rows = aggregate.data ?? [];
    const ratingRows = rows.filter((row: any) => row.avg_numeric_value !== null && row.question_type === 'rating');
    const weight = ratingRows.reduce((sum: number, row: any) => sum + Number(row.response_count), 0);
    const ratingPoints = ratingRows.reduce((sum: number, row: any) => sum + Number(row.avg_numeric_value) * Number(row.response_count), 0);
    const reportableForms = new Map<string, number>();
    for (const submission of submissions.data ?? []) reportableForms.set(submission.feedback_id, Number(submission.response_count));
    const responseCount = [...reportableForms.values()].reduce((sum, value) => sum + value, 0);
    return {
      course_id: courseId,
      response_count: responseCount,
      average_rating: weight ? ratingPoints / weight : null,
      rows
    };
  })).catch(error => ({ error: error instanceof Error ? error.message : 'Comparison failed.' } as const));
  if (!Array.isArray(results)) return jsonError(results.error, 403);

  const feedbackIds = results.flatMap(result => result.rows.map((row: any) => row.feedback_id));
  const { categories, error: categoriesError } = await loadQuestionCategoryMap(supabase, feedbackIds);
  if (categoriesError) return jsonError('Question categories could not be loaded.', 500);

  const questionMap = new Map<string, { question_id:string; question_label:string; question_category:string|null; values:Record<string,{average:number|null;response_count:number}> }>();
  for (const result of results) {
    const enriched = attachQuestionCategories(result.rows, categories);
    for (const row of enriched as any[]) {
      if (row.question_type !== 'rating' || row.avg_numeric_value == null) continue;
      const key = String(row.question_label).toLowerCase().trim();
      const entry: { question_id: string; question_label: string; question_category: string | null; values: Record<string, { average: number | null; response_count: number }> } = questionMap.get(key) ?? {
        question_id: row.question_id,
        question_label: row.question_label,
        question_category: row.question_category ?? null,
        values: {}
      };
      const prior = entry.values[result.course_id];
      const nextCount = Number(row.response_count) + (prior?.response_count ?? 0);
      const nextTotal = Number(row.avg_numeric_value) * Number(row.response_count) + (prior?.average ?? 0) * (prior?.response_count ?? 0);
      entry.values[result.course_id] = { average: nextCount ? nextTotal / nextCount : null, response_count: nextCount };
      questionMap.set(key, entry);
    }
  }

  const courseDetails = (courses ?? []).map(course => {
    const result = results.find(item => item.course_id === course.id);
    return {
      ...course,
      instructor_name: instructorByCourse.get(course.id) ?? 'Unassigned',
      response_count: result?.response_count ?? 0,
      average_rating: result?.average_rating ?? null
    };
  });
  return NextResponse.json({
    courses: courseDetails,
    comparisons: [...questionMap.values()].sort((a,b)=>a.question_label.localeCompare(b.question_label)),
    minimum_group_size: 5
  }, { headers: { 'Cache-Control': 'no-store' } });
}
