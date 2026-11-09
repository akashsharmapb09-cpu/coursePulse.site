import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Teacher inbox is available to instructors only.', 403);

  const { data, error } = await supabase.from('teacher_notifications')
    .select('id,category,period_start,title,body,read_at,created_at')
    .eq('recipient_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return jsonError('Unable to load your notifications.', 500);
  return NextResponse.json({ notifications: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Teacher inbox is available to instructors only.', 403);
  const protection = await protectMutation(request, supabase, 'account:profile-update', 30, 3600);
  if (protection) return protection;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const parsed = z.object({ notification_id: z.string().uuid() }).strict().safeParse(body);
  if (!parsed.success) return jsonError('Invalid notification.');

  const { data, error } = await supabase.from('teacher_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.notification_id)
    .eq('recipient_id', auth.user.id)
    .is('read_at', null)
    .select('id,read_at')
    .maybeSingle();
  if (error) return jsonError('Notification could not be marked as read.', 403);
  return NextResponse.json({ notification: data }, { headers: { 'Cache-Control': 'no-store' } });
}
