import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const questionType = z.enum(['rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no']);
const createSchema = z.object({
  course_id: z.string().uuid().nullable(),
  feedback_id: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(2).max(180),
  type: questionType,
  order_index: z.number().int().min(0).max(99).default(0),
  is_active: z.boolean().default(true),
  is_required: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  category: z.string().trim().max(80).nullable().optional()
}).strict();

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(2).max(180).optional(),
  type: questionType.optional(),
  order_index: z.number().int().min(0).max(99).optional(),
  is_active: z.boolean().optional(),
  is_required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  category: z.string().trim().max(80).nullable().optional()
}).strict().refine(value => Object.keys(value).length > 1, 'Provide at least one question field to update.');

async function syncCatalog(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string | null) {
  const { error } = await supabase.rpc('sync_question_catalog_to_feedback', { p_course_id: courseId });
  return error;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Sign in to view questions.', 401);

  const courseId = request.nextUrl.searchParams.get('course_id');
  const feedbackId = request.nextUrl.searchParams.get('feedback_id');
  if (courseId && !z.string().uuid().safeParse(courseId).success) return jsonError('Invalid course ID.');
  if (feedbackId && !z.string().uuid().safeParse(feedbackId).success) return jsonError('Invalid feedback form ID.');

  let query = supabase.from('questions')
    .select('id,course_id,feedback_id,answer_key,label,type,order_index,is_active,is_required,options,category,created_at,updated_at')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) return jsonError('Question catalogue could not be loaded.', 500);
  let questions = data ?? [];
  if (courseId) questions = questions.filter(q =>
    q.feedback_id === feedbackId ||
    (q.feedback_id === null && (q.course_id === courseId || q.course_id === null))
  );
  if (auth.profile.role === 'STUDENT') questions = questions.filter(q => q.is_active);
  return NextResponse.json({ questions }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role!=='INSTRUCTOR') return jsonError('Only instructors can manage questions.', 403);
  const protection = await protectMutation(request, supabase, 'feedback:create', 30, 3600);
  if (protection) return protection;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid question.');
  if (!auth.profile.organization_id) return jsonError('Your account is not linked to an active college.', 403);

  const { data, error } = await supabase.from('questions').insert({
    organization_id: auth.profile.organization_id,
    created_by: auth.user.id,
    course_id: parsed.data.course_id,
    feedback_id: parsed.data.feedback_id ?? null,
    label: parsed.data.label,
    type: parsed.data.type,
    order_index: parsed.data.order_index,
    is_active: parsed.data.is_active,
    is_required: parsed.data.is_required,
    options: parsed.data.options,
    category: parsed.data.category ?? null
  }).select('id,course_id,feedback_id,answer_key,label,type,order_index,is_active,is_required,options,category').single();
  if (error || !data) return jsonError('Question could not be saved. Check course access and try again.', 403);

  const syncError = await syncCatalog(supabase, parsed.data.course_id);
  if (syncError) return jsonError('Question was saved but feedback forms could not be refreshed. Retry the question sync.', 500);
  return NextResponse.json({ question: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role!=='INSTRUCTOR') return jsonError('Only instructors can manage questions.', 403);
  const protection = await protectMutation(request, supabase, 'feedback:create', 30, 3600);
  if (protection) return protection;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid question update.');
  const { id, ...updates } = parsed.data;
  const { data, error } = await supabase.from('questions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,course_id,feedback_id,answer_key,label,type,order_index,is_active,is_required,options,category')
    .single();
  if (error || !data) return jsonError('Question could not be updated. Check course ownership.', 403);

  const syncError = await syncCatalog(supabase, data.course_id);
  if (syncError) return jsonError('Question was updated but feedback forms could not be refreshed.', 500);
  return NextResponse.json({ question: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role!=='INSTRUCTOR') return jsonError('Only instructors can manage questions.', 403);
  const protection = await protectMutation(request, supabase, 'feedback:create', 30, 3600);
  if (protection) return protection;

  const id = request.nextUrl.searchParams.get('id');
  if (!id || !z.string().uuid().safeParse(id).success) return jsonError('Valid question ID is required.');
  const { data: current, error: lookupError } = await supabase.from('questions')
    .select('id,course_id').eq('id', id).maybeSingle();
  if (lookupError || !current) return jsonError('Question not found or not accessible.', 404);
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) return jsonError('Question could not be deleted.', 403);
  const syncError = await syncCatalog(supabase, current.course_id);
  if (syncError) return jsonError('Question was deleted but feedback forms could not be refreshed.', 500);
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
