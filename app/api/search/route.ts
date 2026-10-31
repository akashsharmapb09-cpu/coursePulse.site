import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError } from '@/lib/http';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Unauthorized',401);
  const raw=request.nextUrl.searchParams.get('q')??'';
  const term=raw.trim().replace(/[%,_]/g,' ').replace(/\s+/g,' ').slice(0,80);
  if(term.length<2) return jsonError('Enter at least two characters to search.');
  const pattern=`%${term}%`;
  const [courses,feedback]=await Promise.all([
    supabase.from('courses').select('id,title,description,status').ilike('title',pattern).limit(10),
    supabase.from('feedback').select('id,course_id,title,description,is_open').ilike('title',pattern).limit(10)
  ]);
  if(courses.error||feedback.error) return jsonError('Search is temporarily unavailable.',500);
  let users:{id:string;full_name:string;email:string|null;role:string}[]=[];
  if(auth.profile.role==='ADMIN'){
    const result=await supabase.from('users').select('id,full_name,email,role').or(`full_name.ilike.${pattern},email.ilike.${pattern}`).limit(10);
    if(result.error) return jsonError('User search is temporarily unavailable.',500);
    users=result.data??[];
  }
  return NextResponse.json({courses:courses.data??[],feedback:feedback.data??[],users},{headers:{'Cache-Control':'no-store'}});
}
