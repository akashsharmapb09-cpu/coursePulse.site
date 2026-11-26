import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const questions = read('supabase/migrations/20261126155310_coursepulse_feedback_portal_questions_tracker_and_anonymous_views.sql');
const projection = read('supabase/migrations/20261126155553_coursepulse_secure_deidentified_feedback_projection.sql');
const auth = read('supabase/migrations/20261126160305_coursepulse_provision_instructor_accounts_from_invitations.sql');
const hardening = read('supabase/migrations/20261126162000_coursepulse_question_catalog_trigger_and_comment_pii_redaction.sql');

describe('CoursePulse database-backed feedback portal contract', () => {
  it('keeps student and course identity in a separate private duplicate tracker', () => {
    const tracker = questions.split('create table if not exists private.submission_tracker')[1]?.split(');')[0] ?? '';
    expect(tracker).toContain('student_id uuid');
    expect(tracker).toContain('course_id uuid');
    expect(tracker).toContain('submitted_at timestamptz');
    expect(tracker).not.toMatch(/feedback_id|answers|comment|ratings_json/i);
    expect(questions).toMatch(/create trigger anonymous_submissions_track_course_once\s+before insert on public\.anonymous_submissions/i);
    expect(questions).toMatch(/primary key \(student_id, course_id\)/i);
  });

  it('does not put student identifiers on instructor-visible submission rows', () => {
    const table = projection.split('create table if not exists public.feedback_submissions')[1]?.split(');')[0] ?? '';
    expect(table).toContain('feedback_id');
    expect(table).toContain('course_id');
    expect(table).toContain('created_at');
    expect(table).toContain('comment text');
    expect(table).toContain('ratings_json jsonb');
    expect(table).not.toMatch(/student_id|user_id|username|email|phone|ip_address/i);
    expect(projection).toMatch(/create policy feedback_submissions_instructor_read[\s\S]*?private\.is_course_owner\(course_id\)/i);
    expect(projection).toMatch(/return v_count >= 5/i);
  });

  it('keeps profile projection read-only and respects underlying users RLS', () => {
    expect(questions).toMatch(/create or replace view public\.profiles with \(security_invoker = true\)/i);
    expect(questions).toMatch(/program as programme/i);
    expect(questions).toMatch(/lower\(role::text\) as role/i);
  });

  it('restricts non-student Auth creation to an active college invitation', () => {
    expect(auth).toMatch(/v_is_internal_username boolean[\s\S]*students\.coursepulse\.invalid/i);
    expect(auth).toMatch(/invitation\.status in \('PENDING','INVITED'\)/i);
    expect(auth).toMatch(/v_invitation\.invited_role::public\.app_role/i);
    expect(auth).toMatch(/instructor_course_assignments/i);
    expect(auth).toMatch(/course_enrollments/i);
    expect(auth).toMatch(/An active college invitation is required/i);
  });

  it('synchronizes shared questions and scrubs common identifiers from free text', () => {
    expect(hardening).toMatch(/create trigger questions_refresh_feedback_forms[\s\S]*?after insert or update or delete on public\.questions/i);
    expect(hardening).toMatch(/create or replace function private\.capture_anonymous_feedback_projection/i);
    expect(hardening).toMatch(/redacted email/i);
    expect(hardening).toMatch(/redacted phone/i);
    expect(hardening).toMatch(/redacted student name/i);
    expect(hardening).toMatch(/redacted student username/i);
    expect(hardening).toMatch(/redacted student number/i);
  });

  it('protects the dashboard and keeps the anonymous CSV on the de-identified surface', () => {
    const page = read('app/dashboard/page.tsx');
    const middleware = read('middleware.ts');
    const exportRoute = read('app/api/exports/[format]/route.ts');
    expect(page).toMatch(/auth\.getUser\(\)/);
    expect(page).toMatch(/redirect\('\/login/);
    expect(page).toMatch(/profile\.role/);
    expect(middleware).toMatch(/pathname === '\/login'/);
    expect(middleware).toMatch(/dashboard/);
    expect(exportRoute).toMatch(/from\('feedback_submissions'\)/);
    expect(exportRoute).toMatch(/detail\) === 'anonymous'/);
    expect(exportRoute).not.toMatch(/student_id|username|student_number/);
  });
});
