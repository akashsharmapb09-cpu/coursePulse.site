import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { feedbackInput } from '@/lib/validation';
import { z } from 'zod';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const id = request.nextUrl.searchParams.get('id');
  let query = supabase.from('feedback').select('id,course_id,title,description,form_schema,is_open,created_at,retention_days').order('created_at', { ascending: false });
  if (id) query = query.eq('id', id);
  const { data, error } = await query;
  if (error) return jsonError('Unable to load feedback forms.', 500);
  let forms = data ?? [];
  if (auth.profile.role === 'STUDENT') {
    const { data: statuses, error: statusError } = await supabase.rpc('get_student_feedback_status');
    if (statusError) return jsonError('Unable to load feedback completion status.', 500);
    const submittedByForm = new Map((statuses ?? []).map((status: { feedback_id: string; submitted: boolean }) => [status.feedback_id, status.submitted]));
    forms = forms.map(form => ({ ...form, submitted: submittedByForm.get(form.id) ?? false }));
  }
  return NextResponse.json(id ? { feedback: forms.find(form => form.id === id) ?? null } : { feedback: forms }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  const protection = await protectMutation(request, supabase, 'feedback:create', 10, 3600);
  if (protection) return protection;
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Only instructors and admins can create feedback forms.', 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = feedbackInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid feedback form.');
  const { data: course, error: courseError } = await supabase.from('courses').select('id').eq('id', parsed.data.course_id).single();
  if (courseError || !course) return jsonError('Course not found or not accessible.', 404);
  const { data, error } = await supabase.from('feedback').insert({
    course_id: parsed.data.course_id, created_by: auth.user.id,
    title: parsed.data.title, description: parsed.data.description,
    form_schema: parsed.data.form_schema, retention_days: parsed.data.retention_days, is_open: true
  }).select('id,course_id,title,description,is_open,created_at').single();
  if (error) return jsonError('Feedback form could not be created. Check course ownership.', 403);
  return NextResponse.json({ feedback: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

const lifecycleInput = z.object({id:z.string().uuid(),is_open:z.boolean()}).strict();

export async function PATCH(request:NextRequest) {
  const supabase=await createClient();
  const auth=await getCurrentUser(supabase);
  if(!auth) return jsonError('Unauthorized',401);
  if(!['ADMIN','INSTRUCTOR'].includes(auth.profile.role)) return jsonError('Only instructors and admins can manage feedback forms.',403);
  const protection=await protectMutation(request,supabase,'feedback:create',10,3600);
  if(protection) return protection;
  let body:unknown;
  try{body=await request.json();}catch{return jsonError('Invalid JSON body.');}
  const parsed=lifecycleInput.safeParse(body);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message??'Invalid feedback update.');
  const {data,error}=await supabase.from('feedback').update({is_open:parsed.data.is_open}).eq('id',parsed.data.id).select('id,is_open').single();
  if(error||!data) return jsonError('Feedback form could not be updated. Check course ownership.',403);
  return NextResponse.json({feedback:data},{headers:{'Cache-Control':'no-store'}});
}
