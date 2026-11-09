import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const updateInput = z.object({
  suggestion_id: z.string().uuid(),
  status: z.enum(['UNDER_REVIEW','IN_PROGRESS','RESOLVED']),
  resolution_note: z.string().trim().min(2).max(1000)
}).strict();

async function requireHead() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return { supabase, auth: null };
  if (auth.profile.role !== 'ADMIN') return { supabase, auth: null };
  return { supabase, auth };
}

export async function GET() {
  const { supabase, auth } = await requireHead();
  if (!auth) return jsonError('College Head administrator MFA is required.', 401);

  const { data: suggestions, error } = await supabase.from('student_suggestions')
    .select('id,student_id,category,title,details,course_id,status,resolution_note,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return jsonError('Unable to load Student Voice submissions.', 500);

  const studentIds = [...new Set((suggestions ?? []).map(item => item.student_id))];
  const { data: students, error: studentError } = studentIds.length
    ? await supabase.from('users').select('id,full_name,email').in('id', studentIds)
    : { data: [], error: null };
  if (studentError) return jsonError('Unable to load suggestion submitter details.', 500);

  const byId = new Map((students ?? []).map(student => [student.id, student]));
  const rows = (suggestions ?? []).map(item => ({
    ...item,
    student_name: byId.get(item.student_id)?.full_name ?? 'Student account',
    student_email: byId.get(item.student_id)?.email ?? null
  }));
  return NextResponse.json({ suggestions: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const { supabase, auth } = await requireHead();
  if (!auth) return jsonError('College Head administrator MFA is required.', 401);
  const protection = await protectMutation(request, supabase, 'admin:user-update', 20, 3600);
  if (protection) return protection;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = updateInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid suggestion update.');

  const { data: current, error: currentError } = await supabase.from('student_suggestions')
    .select('id,category,status')
    .eq('id', parsed.data.suggestion_id)
    .maybeSingle();
  if (currentError || !current) return jsonError('Suggestion not found.', 404);

  const { data, error } = await supabase.from('student_suggestions')
    .update({
      status: parsed.data.status,
      resolution_note: parsed.data.resolution_note,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', parsed.data.suggestion_id)
    .select('id,status,resolution_note,updated_at')
    .maybeSingle();

  if (error || !data) {
    return jsonError(error?.message.includes('Invalid suggestion status transition')
      ? 'Choose the next valid status in the workflow.'
      : 'Suggestion status could not be updated.', 409);
  }

  const { error: auditError } = await supabase.rpc('admin_record_audit', {
    p_action: 'student_suggestion.status_updated',
    p_target_type: 'student_suggestion',
    p_target_id: data.id,
    p_details: { category: current.category, previous_status: current.status, status: data.status }
  });
  if (auditError) return jsonError('Status was updated but the audit record failed. Contact the system administrator.', 500);

  return NextResponse.json({ suggestion: data }, { headers: { 'Cache-Control': 'no-store' } });
}
