import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Unauthorized',401);
  const {data:withinLimit,error:limitError}=await supabase.rpc('consume_api_rate_limit',{p_action:'search:query',p_limit:60,p_window_seconds:60});
  if(limitError) return jsonError('Search is temporarily unavailable.',503);
  if(!withinLimit) return NextResponse.json({error:'Too many searches. Please slow down.'},{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});

  const raw=request.nextUrl.searchParams.get('q')??'';
  const term=raw.trim().replace(/[%,_]/g,' ').replace(/\s+/g,' ').slice(0,80);
  if(term.length<2) return jsonError('Enter at least two characters to search.');
  const pattern=`%${term}%`;
  const [courseTitles,courseCodes,feedback,departments]=await Promise.all([
    supabase.from('courses').select('id,title,description,status,course_code').ilike('title',pattern).limit(10),
    supabase.from('courses').select('id,title,description,status,course_code').ilike('course_code',pattern).limit(10),
    supabase.from('feedback').select('id,course_id,title,description,is_open').ilike('title',pattern).limit(10),
    supabase.from('departments').select('id,name,code').ilike('name',pattern).limit(10)
  ]);
  if(courseTitles.error||courseCodes.error||feedback.error||departments.error) return jsonError('Search is temporarily unavailable.',500);
  const uniqueCourses=new Map<string,{id:string;title:string;description:string;status:string;course_code:string|null}>();
  for(const course of [...(courseTitles.data??[]),...(courseCodes.data??[])]) uniqueCourses.set(course.id,course);
  const courses=Array.from(uniqueCourses.values()).slice(0,10);

  let users:{id:string;full_name:string;email:string|null;role:string}[]=[];
  let instructors:{course_id:string;instructor_name:string}[]=[];
  if(auth.profile.role==='ADMIN'){
    const [names,emails]=await Promise.all([
      supabase.from('users').select('id,full_name,email,role').ilike('full_name',pattern).limit(10),
      supabase.from('users').select('id,full_name,email,role').ilike('email',pattern).limit(10)
    ]);
    if(names.error||emails.error) return jsonError('User search is temporarily unavailable.',500);
    const uniqueUsers=new Map<string,{id:string;full_name:string;email:string|null;role:string}>();
    for(const user of [...(names.data??[]),...(emails.data??[])]) uniqueUsers.set(user.id,user);
    users=Array.from(uniqueUsers.values()).slice(0,10);
    instructors=[];
  } else if(auth.profile.role==='STUDENT') {
    const {data:rows,error:instructorError}=await supabase.rpc('get_student_course_instructors');
    if(instructorError) return jsonError('Instructor search is temporarily unavailable.',500);
    instructors=(rows??[]).filter((row:{course_id:string;instructor_name:string|null})=>
      typeof row.instructor_name==='string'&&row.instructor_name.toLocaleLowerCase().includes(term.toLocaleLowerCase())
    ).map((row:{course_id:string;instructor_name:string})=>({course_id:row.course_id,instructor_name:row.instructor_name})).slice(0,10);
  }
  return NextResponse.json({courses,feedback:feedback.data??[],users,departments:departments.data??[],instructors},{headers:{'Cache-Control':'no-store'}});
}
