import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, consumeRateLimit } from '@/lib/http';
import { analyticsFilterInput } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = ['Course Content','Teaching Effectiveness','Communication','Course Organization','Assessment','Learning Resources','Overall Satisfaction'] as const;

type AggregateRow = { course_id:string; course_title:string; feedback_id:string; feedback_title:string; question_id:string; question_label:string; question_type:string; option_value:string|null; response_count:number; avg_numeric_value:number|null; category:string };

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Analytics are available to instructors and admins only.', 403);
  if (!await consumeRateLimit(supabase, 'analytics:query', 30, 60)) return jsonError('Analytics requests are temporarily rate limited.', 429);

  const params = request.nextUrl.searchParams;
  const filterInput = analyticsFilterInput.safeParse({
    course_id:params.get('course_id') || undefined,
    semester_id:params.get('semester_id') || undefined,
    department_id:params.get('department_id') || undefined,
    instructor_id:params.get('instructor_id') || undefined,
    academic_year:params.get('academic_year') || undefined,
    category:params.get('category') || undefined,
    from_date:params.get('from_date') || undefined,
    to_date:params.get('to_date') || undefined
  });
  if(!filterInput.success) return jsonError(filterInput.error.issues[0]?.message ?? 'One or more report filters are invalid.');
  const {course_id:courseId,semester_id:semesterId,department_id:departmentId,instructor_id:instructorId,academic_year:academicYear,category,from_date:fromDate,to_date:toDate}=filterInput.data;
  if (auth.profile.role === 'INSTRUCTOR' && instructorId && instructorId !== auth.user.id) return jsonError('Instructors can only view their own assigned courses.', 403);

  const [{ data: courses, error: coursesError }, { data: semesters, error: semestersError }, { data: departments, error: departmentsError }, { data: forms, error: formsError }] = await Promise.all([
    supabase.from('courses').select('id,title,instructor_id,department_id,semester_id').order('title').limit(300),
    supabase.from('semesters').select('id,name,start_date,end_date').order('start_date', { ascending: false }).limit(100),
    supabase.from('departments').select('id,name,code').order('name').limit(100),
    supabase.from('feedback').select('id,form_schema').limit(500)
  ]);
  if (coursesError || semestersError || departmentsError || formsError) return jsonError('Unable to load the report filters and form categories.', 500);

  const scopedCourses = (courses ?? []).filter(course =>
    (!courseId || course.id === courseId) &&
    (!departmentId || course.department_id === departmentId) &&
    (!instructorId || course.instructor_id === instructorId)
  );
  const academicYearSemesters = academicYear
    ? (semesters ?? []).filter(semester => semester.start_date?.slice(0,4) === academicYear).map(semester => semester.id)
    : null;
  const selectedSemesterIds = semesterId ? [semesterId] : academicYearSemesters;
  const selectedCourseIds = courseId ? [courseId] : instructorId ? scopedCourses.map(course => course.id) : null;
  if (selectedCourseIds && selectedCourseIds.length === 0) {
    return NextResponse.json({ rows:[], rating_distribution:[], response_trends:[], options:{ courses:courses??[],semesters:semesters??[],departments:departments??[],instructors:[] ,academic_years:[],categories }, filters:{ course_id:courseId,semester_id:semesterId,department_id:departmentId,instructor_id:instructorId,academic_year:academicYear,category,from_date:fromDate,to_date:toDate }, minimum_group_size:5,raw_answers_included:false }, { headers:{'Cache-Control':'no-store'} });
  }
  if (selectedSemesterIds && selectedSemesterIds.length === 0) {
    return NextResponse.json({ rows:[],rating_distribution:[],response_trends:[],options:{courses:courses??[],semesters:semesters??[],departments:departments??[],instructors:[],academic_years:[],categories},filters:{course_id:courseId,semester_id:semesterId,department_id:departmentId,instructor_id:instructorId,academic_year:academicYear,category,from_date:fromDate,to_date:toDate},minimum_group_size:5,raw_answers_included:false }, {headers:{'Cache-Control':'no-store'}});
  }

  const courseScopes = selectedCourseIds ?? [null];
  const semesterScopes = selectedSemesterIds ?? [null];
  const calls = courseScopes.flatMap(id => semesterScopes.map(semester => ({
    p_course_id:id, p_from_date:fromDate ?? null, p_to_date:toDate ?? null, p_semester_id:semester, p_department_id:departmentId
  })));
  if (calls.length > 100) return jsonError('This filter combination is too broad. Narrow the course or academic-year selection.');

  const results = await Promise.all(calls.map(async filter => {
    const [aggregates, ratings, trends] = await Promise.all([
      supabase.rpc('get_instructor_aggregates_filtered', filter),
      supabase.rpc('get_instructor_rating_distribution_filtered', filter),
      supabase.rpc('get_instructor_response_trends_filtered', filter)
    ]);
    return { aggregates,ratings,trends };
  }));
  if (results.some(result => result.aggregates.error || result.ratings.error || result.trends.error)) {
    return jsonError('Unable to load authorized aggregate analytics for these filters.', 403);
  }

  const questionCategories = new Map<string,string>();
  for (const form of forms ?? []) {
    for (const question of (Array.isArray(form.form_schema) ? form.form_schema : []) as {id?:string;category?:string}[]) {
      if (question.id) questionCategories.set(`${form.id}:${question.id}`, categories.includes(question.category as typeof categories[number]) ? question.category! : 'Overall Satisfaction');
    }
  }
  let rows:AggregateRow[] = results.flatMap(result => result.aggregates.data ?? []).map(row => ({
    ...row, category:questionCategories.get(`${row.feedback_id}:${row.question_id}`) ?? 'Overall Satisfaction'
  }));
  let ratingDistribution = results.flatMap(result => result.ratings.data ?? []).map(row => ({
    ...row, category:questionCategories.get(`${row.feedback_id}:${row.question_id}`) ?? 'Overall Satisfaction'
  }));
  const responseTrends = results.flatMap(result => result.trends.data ?? []);

  const unique = <T,>(items:T[], key:(item:T)=>string) => Array.from(new Map(items.map(item=>[key(item),item])).values());
  rows = unique(rows, row=>`${row.feedback_id}:${row.question_id}:${row.option_value ?? ''}`);
  ratingDistribution = unique(ratingDistribution, row=>`${row.feedback_id}:${row.question_id}:${row.rating_value}`);
  const filteredRows = category ? rows.filter(row=>row.category===category) : rows;
  const filteredRatings = category ? ratingDistribution.filter(row=>row.category===category) : ratingDistribution;
  let instructorOptions:{id:string;name:string}[] = [{id:auth.user.id,name:auth.profile.full_name}];
  if (auth.profile.role === 'ADMIN') {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === 'aal2') {
      const { data: instructorProfiles } = await supabase.from('users').select('id,full_name').eq('role','INSTRUCTOR').order('full_name').limit(200);
      instructorOptions = (instructorProfiles ?? []).map(user=>({id:user.id,name:user.full_name}));
    }
  }
  const academicYears = Array.from(new Set((semesters ?? []).map(semester=>semester.start_date?.slice(0,4)).filter(Boolean))).sort().reverse().map(year=>`${year}-${Number(year)+1}`);

  return NextResponse.json({
    rows:filteredRows,
    rating_distribution:filteredRatings,
    response_trends:category ? [] : responseTrends,
    options:{ courses:scopedCourses,semesters:semesters??[],departments:departments??[],instructors:instructorOptions,academic_years:academicYears,categories },
    filters:{course_id:courseId,semester_id:semesterId,department_id:departmentId,instructor_id:instructorId,academic_year:academicYear,category,from_date:fromDate,to_date:toDate},
    minimum_group_size:5,
    raw_answers_included:false
  }, { headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'} });
}
