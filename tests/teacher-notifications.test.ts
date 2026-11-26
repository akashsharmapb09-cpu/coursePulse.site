import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/teacher-notifications/route.ts'), 'utf8');
const inbox = readFileSync(resolve(process.cwd(), 'components/teacher-inbox.tsx'), 'utf8');
const triggerMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261126122940_coursepulse_teacher_notification_center.sql'), 'utf8');
const dismissalMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261126123713_coursepulse_teacher_notification_dismissal.sql'), 'utf8');
const digestRefreshMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261126124137_coursepulse_refresh_dismissed_feedback_digest.sql'), 'utf8');

describe('teacher Notification Center', () => {
  it('restricts the notification API to the signed-in instructor', () => {
    expect(route).toContain("auth.profile.role !== 'INSTRUCTOR'");
    expect(route).toContain(".eq('recipient_id', auth.user.id)");
    expect(route).toContain(".is('dismissed_at', null)");
  });

  it('creates pending reminders and deadline alerts from open forms', () => {
    expect(route).toContain(".eq('is_open', true)");
    expect(route).toContain("'PENDING_FEEDBACK'");
    expect(route).toContain("'DEADLINE_ALERT'");
    expect(route).toContain('due within 7 days');
    expect(route).toContain('overdue');
    expect(route).toContain("onConflict: 'recipient_id,category,period_start'");
  });

  it('supports individual and bulk mark-as-read and safe clear-all actions', () => {
    expect(route).toContain("const markAllInput = z.object({ mark_all: z.literal(true) })");
    expect(route).toContain(".update({ read_at: new Date().toISOString() })");
    expect(route).toContain(".update({ dismissed_at: new Date().toISOString() })");
    expect(route).not.toContain(".delete()");
    expect(inbox).toContain("body: JSON.stringify({ mark_all: true })");
    expect(inbox).toContain("method: 'DELETE'");
    expect(inbox).toContain('Mark all read');
    expect(inbox).toContain('Clear all');
  });

  it('creates generic alerts on anonymous submissions without storing answer or student identity', () => {
    expect(triggerMigration).toContain('after insert on public.anonymous_submissions');
    expect(triggerMigration).toContain('NEW_FEEDBACK');
    expect(triggerMigration).toContain('Student identities and individual answers remain private');
    expect(triggerMigration).not.toContain('new.answers');
    expect(triggerMigration).not.toContain('new.student_id');
  });

  it('soft-dismisses alerts and keeps period de-duplication intact', () => {
    expect(dismissalMigration).toContain('add column if not exists dismissed_at timestamptz');
    expect(dismissalMigration).toContain('revoke delete on public.teacher_notifications from authenticated');
    expect(dismissalMigration).toContain('Notification dismissal is not permitted');
    expect(triggerMigration).toContain('on conflict (recipient_id, category, period_start)');
  });

  it('re-opens the daily feedback digest only when a new anonymous response arrives', () => {
    expect(digestRefreshMigration).toContain('read_at = null');
    expect(digestRefreshMigration).toContain('dismissed_at = null');
    expect(digestRefreshMigration).toContain('create or replace function private.notify_instructors_of_anonymous_feedback()');
  });

  it('renders an unread bell, preview, individual mark-read actions and notification labels', () => {
    expect(inbox).toContain('NotificationBell');
    expect(inbox).toContain('notification-count');
    expect(inbox).toContain('New feedback');
    expect(inbox).toContain('Deadline');
    expect(inbox).toContain('Mark read');
    expect(inbox).toContain('Private and anonymous by design');
  });
});
