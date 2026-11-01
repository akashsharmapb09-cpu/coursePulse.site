import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { courseInput } from '@/lib/validation';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const { data, error } = await supabase.from('courses')
    .select('id,course_code,title,description,status,created_at,instructor_id,semester_id,semester:semesters(id,name),department:departments(id,name,code)')
    .order('created_at', { ascending: false });
  if (error) return jsonError('Unable to load courses.', 500);
  let courses=data??[];
  if(auth.profile.role==='STUDENT'&&courses.length){
    const {data:instructors,error:instructorError}=await supabase.rpc('get_student_course_instructors');
    if(instructorError) return jsonError('Unable to load course instructor details.',500);
    const byCourse=new Map<string,string[]>();
    for(const row of instructors??[]){
      const names=byCourse.get(row.course_id)??[];
      if(typeof row.instructor_name==='string'&&!names.includes(row.instructor_name)) names.push(row.instructor_name);
      byCourse.set(row.course_id,names);
    }
    courses=courses.map(({instructor_id,...course})=>({...course,instructors:byCourse.get(course.id)??[]}));
  }
  return NextResponse.json({ courses }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const protection = await protectMutation(request, supabase, 'courses:create', 10, 3600);
  if (protection) return protection;
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Only instructors and admins can create courses.', 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = courseInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid course details.');
  const { data, error } = await supabase.from('courses').insert({
    instructor_id: auth.user.id,
    course_code: parsed.data.course_code || null,
    title: parsed.data.title,
    description: parsed.data.description,
    status: 'PUBLISHED'
  }).select('id,course_code,title,description,status,created_at,instructor_id,semester_id,semester:semesters(id,name),department:departments(id,name,code)').single();
  if (error) return jsonError('Course could not be created. Check your role and try again.', 403);
  return NextResponse.json({ course: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

const courseUpdateInput=z.object({
  id:z.string().uuid(),
  title:z.string().trim().min(2).max(160).optional(),
  description:z.string().trim().max(5000).optional(),
  status:z.enum(['DRAFT','PUBLISHED','ARCHIVED']).optional(),
  course_code:z.string().trim().min(2).max(30).nullable().optional()
}).strict().refine(input=>Object.keys(input).length>1,'Provide at least one course field to update.');

export async function PATCH(request:NextRequest) {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Unauthorized',401);
  if(!['ADMIN','INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Only instructors and admins can manage courses.',403);
  const protection=await protectMutation(request,supabase,'courses:create',10,3600);
  if(protection) return protection;
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=courseUpdateInput.safeParse(body);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message??'Invalid course update.');
  const {id,...updates}=parsed.data;
  const {data,error}=await supabase.from('courses').update(updates).eq('id',id).select('id,course_code,title,description,status,created_at,instructor_id,semester_id,semester:semesters(id,name),department:departments(id,name,code)').single();
  if(error||!data) return jsonError('Course could not be updated. Check course ownership.',403);
  return NextResponse.json({course:data},{headers:{'Cache-Control':'no-store'}});
}
