import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(resolve(process.cwd(), 'components/dashboard.tsx'), 'utf8');
const originalFeatureMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108153000_coursepulse_student_voice_teacher_notifications.sql'), 'utf8');
const removalMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261126171000_coursepulse_remove_student_voice.sql'), 'utf8');
const notificationsRoute = readFileSync(resolve(process.cwd(), 'app/api/teacher-notifications/route.ts'), 'utf8');
const monthlyNotifyRoute = readFileSync(resolve(process.cwd(), 'app/api/admin/teacher-notifications/route.ts'), 'utf8');

describe('CoursePulse feature scope and teacher notifications', () => {
  it('removes the unrelated Student Voice UI and dedicated API routes', () => {
    expect(dashboard).not.toMatch(/Student Voice|StudentVoice|student-voice|student_suggestions/);
    expect(existsSync(resolve(process.cwd(), 'components/student-voice.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'components/admin-student-voice.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'app/api/student-voice/route.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'app/api/admin/student-voice/route.ts'))).toBe(false);
  });

  it('drops the legacy suggestions table only after locking and confirming it is empty', () => {
    expect(removalMigration).toMatch(/LOCK TABLE public\.student_suggestions IN ACCESS EXCLUSIVE MODE/i);
    expect(removalMigration).toMatch(/SELECT count\(\*\) INTO v_rows FROM public\.student_suggestions/i);
    expect(removalMigration).toMatch(/IF v_rows > 0 THEN/i);
    expect(removalMigration).toMatch(/DROP TABLE public\.student_suggestions/i);
    expect(removalMigration).not.toMatch(/DROP TABLE public\.teacher_notifications/i);
  });

  it('keeps the independent private teacher-notification table and recipient policies', () => {
    expect(originalFeatureMigration).toMatch(/create table public\.teacher_notifications/i);
    expect(originalFeatureMigration).toContain('teacher_notifications_recipient_read');
    expect(originalFeatureMigration).toContain('teacher_notifications_recipient_update');
    expect(notificationsRoute).toContain(".eq('recipient_id', auth.user.id)");
    expect(notificationsRoute).toContain("auth.profile.role !== 'INSTRUCTOR'");
  });

  it('creates teacher review notices from privacy-safe aggregate thresholds', () => {
    expect(monthlyNotifyRoute).toContain("rpc('get_instructor_aggregates_filtered'");
    expect(monthlyNotifyRoute).toContain('minimum_responses');
    expect(monthlyNotifyRoute).toContain('onConflict:');
    expect(monthlyNotifyRoute).not.toContain('answers');
    expect(monthlyNotifyRoute).not.toContain('student_id');
  });
});
