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
  const query = supabase.from('courses').select('id,title,description,status,created_at,instructor_id').order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return jsonError('Unable to load courses.', 500);
  return NextResponse.json({ courses: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
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
    title: parsed.data.title,
    description: parsed.data.description,
    status: 'PUBLISHED'
  }).select('id,title,description,status,created_at,instructor_id').single();
  if (error) return jsonError('Course could not be created. Check your role and try again.', 403);
  return NextResponse.json({ course: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

const courseUpdateInput=z.object({
  id:z.string().uuid(),
  title:z.string().trim().min(2).max(160).optional(),
  description:z.string().trim().max(5000).optional(),
  status:z.enum(['DRAFT','PUBLISHED','ARCHIVED']).optional()
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
  const {data,error}=await supabase.from('courses').update(updates).eq('id',id).select('id,title,description,status,created_at,instructor_id').single();
  if(error||!data) return jsonError('Course could not be updated. Check course ownership.',403);
  return NextResponse.json({course:data},{headers:{'Cache-Control':'no-store'}});
}
