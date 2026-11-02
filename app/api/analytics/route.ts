import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkReadRateLimit, getCurrentUser, jsonError } from '@/lib/http';
import { attachQuestionCategories, isQuestionCategory, loadQuestionCategoryMap } from '@/lib/question-categories';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Analytics are available to instructors and admins only.', 403);
  const rateLimit = await checkReadRateLimit(supabase, 'analytics:query', 30, 3600);
  if (rateLimit) return rateLimit;
  const params=request.nextUrl.searchParams;
  const courseId=params.get('course_id');
  const semesterId=params.get('semester_id');
  const departmentId=params.get('department_id');
  const fromDate=params.get('from_date');
  const toDate=params.get('to_date');
  const questionCategory=params.get('question_category');
  if(courseId&&!/^[0-9a-f-]{36}$/i.test(courseId)) return jsonError('Invalid course ID.');
  if(semesterId&&!/^[0-9a-f-]{36}$/i.test(semesterId)) return jsonError('Invalid semester ID.');
  if(departmentId&&!/^[0-9a-f-]{36}$/i.test(departmentId)) return jsonError('Invalid department ID.');
  if(questionCategory&&!isQuestionCategory(questionCategory)) return jsonError('Invalid question category.');
  const validDate=(value:string|null)=>{if(!value)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T00:00:00.000Z');return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;};
  if(!validDate(fromDate)||!validDate(toDate)) return jsonError('Dates must use YYYY-MM-DD format.');
  if(fromDate&&toDate&&fromDate>toDate) return jsonError('Start date must be on or before end date.');
  const rpcArgs={p_course_id:courseId,p_from_date:fromDate,p_to_date:toDate,p_semester_id:semesterId,p_department_id:departmentId};
  const [aggregateResult,ratingResult,trendResult]=await Promise.all([
    supabase.rpc('get_instructor_aggregates_filtered',rpcArgs),
    supabase.rpc('get_instructor_rating_distribution_filtered',rpcArgs),
    supabase.rpc('get_instructor_response_trends_filtered',rpcArgs)
  ]);
  if(aggregateResult.error||ratingResult.error||trendResult.error) return jsonError('Unable to load aggregate analytics.',403);
  const aggregateRows=aggregateResult.data??[];
  const ratingRows=ratingResult.data??[];
  const feedbackIds=[...aggregateRows,...ratingRows].map(row=>row.feedback_id);
  const {categories,error:categoryError}=await loadQuestionCategoryMap(supabase,feedbackIds);
  if(categoryError) return jsonError('Unable to load question categories.',500);
  const categorizedRows=attachQuestionCategories(aggregateRows,categories);
  const categorizedRatings=attachQuestionCategories(ratingRows,categories);
  const rows=questionCategory?categorizedRows.filter(row=>row.question_category===questionCategory):categorizedRows;
  const ratingDistributions=questionCategory?categorizedRatings.filter(row=>row.question_category===questionCategory):categorizedRatings;
  return NextResponse.json({rows,rating_distributions:ratingDistributions,trends:trendResult.data??[],minimum_group_size:5,raw_answers_included:false},{headers:{'Cache-Control':'no-store'}});
}
