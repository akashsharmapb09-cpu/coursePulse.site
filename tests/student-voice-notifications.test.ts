import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108153000_coursepulse_student_voice_teacher_notifications.sql'), 'utf8');
const studentRoute = readFileSync(resolve(process.cwd(), 'app/api/student-voice/route.ts'), 'utf8');
const adminRoute = readFileSync(resolve(process.cwd(), 'app/api/admin/student-voice/route.ts'), 'utf8');
const notificationsRoute = readFileSync(resolve(process.cwd(), 'app/api/teacher-notifications/route.ts'), 'utf8');
const monthlyNotifyRoute = readFileSync(resolve(process.cwd(), 'app/api/admin/teacher-notifications/route.ts'), 'utf8');

describe('Student Voice and private teacher notifications', () => {
  it('keeps identified college suggestions separate from anonymous answer records', () => {
    expect(migration).toContain('student_id uuid not null');
    expect(migration).toContain('separate from anonymous feedback answer storage');
    expect(studentRoute).toContain("auth.profile.role !== 'STUDENT'");
    expect(studentRoute).toContain("student_id: auth.user.id");
    expect(studentRoute).not.toContain('anonymous_submissions');
  });

  it('restricts student suggestion records to their author and the MFA-protected Head', () => {
    expect(migration).toContain('student_suggestions_student_read');
    expect(migration).toContain('student_suggestions_student_insert');
    expect(migration).toContain('student_suggestions_admin_read');
    expect(migration).toContain('student_suggestions_admin_update');
    expect(migration).toContain('private.is_admin()');
    expect(adminRoute).toContain("auth.profile.role !== 'ADMIN'");
    expect(adminRoute).toContain("admin_record_audit");
  });

  it('prevents changing suggestion content and rejects invalid workflow transitions', () => {
    expect(migration).toContain('Suggestion content and ownership are immutable');
    expect(migration).toContain('Invalid suggestion status transition');
    expect(adminRoute).toContain("status: z.enum(['UNDER_REVIEW','IN_PROGRESS','RESOLVED'])");
  });

  it('allows teachers to see and mark only their own immutable notification content as read', () => {
    expect(migration).toContain('teacher_notifications_recipient_read');
    expect(migration).toContain('teacher_notifications_recipient_update');
    expect(migration).toContain('Notification content is immutable');
    expect(notificationsRoute).toContain(".eq('recipient_id', auth.user.id)");
    expect(notificationsRoute).toContain("auth.profile.role !== 'INSTRUCTOR'");
  });

  it('creates private low-rating meeting requests from server-calculated aggregate thresholds', () => {
    expect(monthlyNotifyRoute).toContain("rpc('get_instructor_aggregates_filtered'");
    expect(monthlyNotifyRoute).toContain('minimum_responses');
    expect(monthlyNotifyRoute).toContain('onConflict:');
    expect(monthlyNotifyRoute).not.toContain('answers');
    expect(monthlyNotifyRoute).not.toContain('student_id');
  });
});
