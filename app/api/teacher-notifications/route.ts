import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

type FeedbackReminderForm = { id: string; title: string; due_at: string | null };

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mondayOfWeek(date: Date) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return dateOnly(monday);
}

async function createAutomaticReminders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  instructorId: string
) {
  const { data, error } = await supabase
    .from('feedback')
    .select('id,title,due_at')
    .eq('is_open', true)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) throw new Error('Feedback reminders could not be prepared.');
  const forms = (data ?? []) as FeedbackReminderForm[];
  const now = new Date();
  const today = dateOnly(now);
  const weekStart = mondayOfWeek(now);
  const nowTime = now.getTime();
  const nextWeek = nowTime + 7 * 24 * 60 * 60 * 1000;
  const dueSoon = forms.filter(form => form.due_at && new Date(form.due_at).getTime() >= nowTime && new Date(form.due_at).getTime() <= nextWeek);
  const overdue = forms.filter(form => form.due_at && new Date(form.due_at).getTime() < nowTime);

  const reminders = [];
  if (forms.length) {
    reminders.push({
      recipient_id: instructorId,
      created_by: instructorId,
      category: 'PENDING_FEEDBACK',
      period_start: weekStart,
      title: 'Pending feedback reminder',
      body: `You have ${forms.length} open feedback form${forms.length === 1 ? '' : 's'} in your assigned courses. Review their progress in Analytics and decide whether each form should remain open or be closed. Student identities and individual answers are never included in this reminder.`
    });
  }

  if (dueSoon.length || overdue.length) {
    const preview = [...overdue, ...dueSoon].slice(0, 5).map(form => {
      const due = form.due_at
        ? new Date(form.due_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
        : '';
      return `${form.title} (${due})`;
    });
    const more = overdue.length + dueSoon.length > preview.length
      ? ` and ${overdue.length + dueSoon.length - preview.length} more`
      : '';
    const status = [
      overdue.length ? `${overdue.length} overdue` : '',
      dueSoon.length ? `${dueSoon.length} due within 7 days` : ''
    ].filter(Boolean).join(' · ');
    reminders.push({
      recipient_id: instructorId,
      created_by: instructorId,
      category: 'DEADLINE_ALERT',
      period_start: today,
      title: 'Feedback deadline alert',
      body: `${status}: ${preview.join('; ')}${more}. Review these forms to update a deadline or close a completed form.`
    });
  }

  if (reminders.length) {
    const { error: reminderError } = await supabase
      .from('teacher_notifications')
      .upsert(reminders, {
        onConflict: 'recipient_id,category,period_start',
        ignoreDuplicates: true
      });
    if (reminderError) throw new Error('Feedback reminders could not be saved.');
  }
}

const notificationInput = z.object({ notification_id: z.string().uuid() }).strict();
const markAllInput = z.object({ mark_all: z.literal(true) }).strict();

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Notification Center is available to instructors only.', 403);

  try {
    await createAutomaticReminders(supabase, auth.user.id);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Notifications could not be prepared.', 500);
  }

  const { data, error } = await supabase.from('teacher_notifications')
    .select('id,category,period_start,title,body,read_at,created_at')
    .eq('recipient_id', auth.user.id)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return jsonError('Unable to load your notifications.', 500);
  return NextResponse.json({ notifications: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Notification Center is available to instructors only.', 403);
  const protection = await protectMutation(request, supabase, 'account:profile-update', 30, 3600);
  if (protection) return protection;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }

  if (markAllInput.safeParse(body).success) {
    const { data, error } = await supabase.from('teacher_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', auth.user.id)
      .is('dismissed_at', null)
      .is('read_at', null)
      .select('id');
    if (error) return jsonError('Notifications could not be marked as read.', 403);
    return NextResponse.json({ updated: data?.length ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const parsed = notificationInput.safeParse(body);
  if (!parsed.success) return jsonError('Invalid notification.');
  const { data, error } = await supabase.from('teacher_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.notification_id)
    .eq('recipient_id', auth.user.id)
    .is('dismissed_at', null)
    .is('read_at', null)
    .select('id,read_at')
    .maybeSingle();
  if (error) return jsonError('Notification could not be marked as read.', 403);
  return NextResponse.json({ notification: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);
  if (auth.profile.role !== 'INSTRUCTOR') return jsonError('Notification Center is available to instructors only.', 403);
  const protection = await protectMutation(request, supabase, 'account:profile-update', 10, 3600);
  if (protection) return protection;

  const { data, error } = await supabase.from('teacher_notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('recipient_id', auth.user.id)
    .is('dismissed_at', null)
    .select('id');
  if (error) return jsonError('Notifications could not be cleared.', 403);
  return NextResponse.json({ cleared: data?.length ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
}
