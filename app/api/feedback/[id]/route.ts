import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { feedbackUpdateInput } from '@/lib/validation';
import { consumeRateLimit, getCurrentUser, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const paramsSchema = z.string().uuid();
const statusSchema = z.object({ is_open: z.boolean() }).strict();
const restoreSchema = z.object({ restore_version: z.number().int().min(1) }).strict();

async function requireFormManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const auth = await getCurrentUser(supabase);
  if (!auth) return { error: jsonError('Unauthorized', 401) };
  if (!['ADMIN', 'INSTRUCTOR'].includes(auth.profile.role)) return { error: jsonError('Only instructors and administrators can manage feedback forms.', 403) };
  if (auth.profile.role === 'ADMIN') {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data?.currentLevel !== 'aal2') return { error: jsonError('Complete administrator MFA before managing feedback forms.', 403) };
  }
  return { auth };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const access = await requireFormManager(supabase);
  if (access.error) return access.error;
  const { id } = await context.params;
  if (!paramsSchema.safeParse(id).success) return jsonError('Invalid feedback form ID.');
  const [{ data: form, error: formError }, { data: versions, error: versionsError }] = await Promise.all([
    supabase.from('feedback').select('id,course_id,title,description,form_schema,is_open,created_at,retention_days,due_at,version').eq('id', id).maybeSingle(),
    supabase.rpc('get_feedback_versions', { p_feedback_id: id })
  ]);
  if (formError) return jsonError('Unable to load feedback form.', 500);
  if (!form) return jsonError('Feedback form not found or not accessible.', 404);
  if (versionsError) return jsonError('Unable to load feedback version history.', 500);
  return NextResponse.json({ feedback: form, versions: versions ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const access = await requireFormManager(supabase);
  if (access.error) return access.error;
  if (!await consumeRateLimit(supabase, 'feedback:create', 20, 60)) return jsonError('Form management is temporarily rate limited.', 429);
  const { id } = await context.params;
  if (!paramsSchema.safeParse(id).success) return jsonError('Invalid feedback form ID.');
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const status = statusSchema.safeParse(body);
  if (status.success) {
    const { data, error } = await supabase.from('feedback').update({ is_open: status.data.is_open }).eq('id', id).select('id,is_open,due_at').maybeSingle();
    if (error) return jsonError('Feedback form status could not be updated.', 403);
    if (!data) return jsonError('Feedback form not found or not accessible.', 404);
    return NextResponse.json({ feedback: data }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const parsed = feedbackUpdateInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid feedback form update.');
  const { data, error } = await supabase.from('feedback').update(parsed.data).eq('id', id)
    .select('id,course_id,title,description,form_schema,is_open,created_at,retention_days,due_at,version').maybeSingle();
  if (error) return jsonError('Feedback form could not be updated. Check ownership and question values.', 403);
  if (!data) return jsonError('Feedback form not found or not accessible.', 404);
  if (access.auth!.profile.role === 'ADMIN') {
    await supabase.rpc('admin_record_audit', { p_action: 'feedback.form_updated', p_target_type: 'feedback', p_target_id: data.id, p_details: { version: data.version } });
  }
  return NextResponse.json({ feedback: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const access = await requireFormManager(supabase);
  if (access.error) return access.error;
  if (!await consumeRateLimit(supabase, 'feedback:create', 10, 60)) return jsonError('Version restore is temporarily rate limited.', 429);
  const { id } = await context.params;
  if (!paramsSchema.safeParse(id).success) return jsonError('Invalid feedback form ID.');
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) return jsonError('Choose a valid form version.');
  const { data, error } = await supabase.rpc('restore_feedback_version', { p_feedback_id: id, p_version: parsed.data.restore_version });
  if (error) return jsonError('The selected form version could not be restored. Check ownership and version history.', 409);
  if (access.auth!.profile.role === 'ADMIN') {
    await supabase.rpc('admin_record_audit', { p_action: 'feedback.version_restored', p_target_type: 'feedback', p_target_id: id, p_details: { restored_from_version: parsed.data.restore_version, new_version: data } });
  }
  return NextResponse.json({ success: true, version: data }, { headers: { 'Cache-Control': 'no-store' } });
}
