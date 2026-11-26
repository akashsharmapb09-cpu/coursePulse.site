import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const schema = read('supabase/migrations/20261126155310_coursepulse_feedback_portal_questions_tracker_and_anonymous_views.sql');
const projection = read('supabase/migrations/20261126155553_coursepulse_secure_deidentified_feedback_projection.sql');
const authMigration = read('supabase/migrations/20261126160305_coursepulse_provision_instructor_accounts_from_invitations.sql');
const questionSync = read('supabase/migrations/20261126160539_coursepulse_sync_questions_and_privacy_hardening.sql');
const filteredRpc = read('supabase/migrations/20261126160927_coursepulse_filtered_anonymous_comment_rpc_and_read_hardening.sql');
const denyProjection = read('supabase/migrations/20261126161143_coursepulse_deny_direct_feedback_projection_reads.sql');
const finalHardening = read('supabase/migrations/20261126161259_coursepulse_question_catalog_trigger_and_comment_pii_redaction.sql');

describe('CoursePulse authenticated feedback portal', () => {
  it('keeps the existing users table canonical while exposing a limited profile view', () => {
    expect(schema).toMatch(/create or replace view public\.profiles with \(security_invoker\s*=\s*true\)/i);
    expect(schema).toMatch(/program as programme/i);
    expect(schema).toMatch(/revoke all on public\.profiles from public, anon/i);
    expect(schema).toMatch(/grant select on public\.profiles to authenticated/i);
  });

  it('stores normalized questions and enforces instructor ownership with RLS', () => {
    expect(schema).toMatch(/create table if not exists public\.questions/i);
    expect(schema).toMatch(/alter table public\.questions enable row level security/i);
    expect(schema).toMatch(/alter table public\.questions force row level security/i);
    expect(schema).toMatch(/create policy questions_insert_instructor/i);
    expect(schema).toMatch(/private\.is_course_owner\(course_id\)/i);
    expect(schema).toMatch(/insert into public\.questions[\s\S]*?jsonb_array_elements/i);
    expect(finalHardening).toMatch(/create trigger questions_refresh_feedback_forms[\s\S]*?after insert or update or delete on public\.questions/i);
    const questionRoute = read('app/api/questions/route.ts');
    expect(questionRoute).toMatch(/export async function (GET|POST|PATCH|DELETE)/);
  });

  it('keeps course-level duplicate tracking separate from anonymous answer rows', () => {
    expect(schema).toMatch(/create table if not exists private\.submission_tracker/i);
    expect(schema).toMatch(/primary key \(student_id, course_id\)/i);
    const tracker = schema.split('create table if not exists private.submission_tracker')[1]?.split(');')[0] ?? '';
    expect(tracker).toContain('student_id');
    expect(tracker).toContain('course_id');
    expect(tracker).not.toMatch(/feedback_id|submission_id|answers|response_id/i);
    expect(schema).toMatch(/create trigger anonymous_submissions_track_course_once/i);
  });

  it('keeps personally identifying student fields off the instructor response projection', () => {
    const table = projection.split('create table if not exists public.feedback_submissions')[1]?.split(');')[0] ?? '';
    expect(table).toContain('feedback_id');
    expect(table).toContain('course_id');
    expect(table).toContain('comment');
    expect(table).toContain('ratings_json');
    expect(table).not.toMatch(/student_id|user_id|email|username|ip_address|tracker/i);
    expect(questionSync).toMatch(/redacted email/i);
    expect(questionSync).toMatch(/redacted phone/i);
    expect(questionSync).toMatch(/redacted student identifier/i);
    expect(finalHardening).toMatch(/redacted student name/i);
    expect(finalHardening).toMatch(/redacted student username/i);
    expect(finalHardening).toMatch(/redacted student number/i);
  });

  it('denies direct projection reads and requires filtered cohorts of at least five', () => {
    expect(denyProjection).toMatch(/revoke all on table public\.feedback_submissions from public, anon, authenticated, service_role/i);
    expect(denyProjection).toMatch(/create policy feedback_submissions_deny_api[\s\S]*?using \(false\)/i);
    expect(filteredRpc).toMatch(/create or replace function private\.get_filtered_anonymous_feedback/i);
    expect(filteredRpc).toMatch(/security definer[\s\S]*?set row_security = off/i);
    expect(filteredRpc).toMatch(/group_count\s*>=\s*5/i);
    expect(filteredRpc).toMatch(/p_from_date[\s\S]*?p_to_date/i);
    expect(filteredRpc).toMatch(/create or replace function public\.get_filtered_anonymous_feedback[\s\S]*?security invoker/i);
  });

  it('restricts non-student Auth creation to an active college invitation', () => {
    expect(authMigration).toMatch(/v_is_internal_username boolean[\s\S]*students\.coursepulse\.invalid/i);
    expect(authMigration).toMatch(/invitation\.status in \('PENDING','INVITED'\)/i);
    expect(authMigration).toMatch(/v_invitation\.invited_role::public\.app_role/i);
    expect(authMigration).toMatch(/instructor_course_assignments/i);
    expect(authMigration).toMatch(/An active college invitation is required/i);
  });

  it('authenticates the dashboard and keeps public signup Student-only', () => {
    const dashboard = read('app/dashboard/page.tsx');
    const middleware = read('middleware.ts');
    const authForm = read('components/student-auth-form.tsx');
    expect(dashboard).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(dashboard).toMatch(/redirect\('\/login/);
    expect(dashboard).toMatch(/profile\.role/);
    expect(middleware).toMatch(/destination\.pathname = '\/login'/);
    expect(middleware).toMatch(/dashboard/);
    expect(authForm).toMatch(/mode === 'signup'/);
    expect(authForm).toMatch(/role !== 'STUDENT'/);
    expect(authForm).toMatch(/signInWithPassword/);
  });

  it('routes comments, comparisons and anonymous CSV through the filtered RPC', () => {
    const comments = read('app/api/comments/route.ts');
    const compare = read('app/api/analytics/compare/route.ts');
    const exportRoute = read('app/api/exports/[format]/route.ts');
    expect(comments).toMatch(/rpc\('get_filtered_anonymous_feedback'/);
    expect(compare).toMatch(/rpc\('get_filtered_anonymous_feedback'/);
    expect(exportRoute).toMatch(/rpc\('get_filtered_anonymous_feedback'/);
    expect(exportRoute).toMatch(/detail.*anonymous/);
    expect(exportRoute).toMatch(/p_semester_id/);
    expect(exportRoute).toMatch(/p_from_date/);
    expect(exportRoute).toMatch(/p_to_date/);
    expect(comments).toMatch(/p_search/);
    expect(exportRoute).not.toMatch(/from\('feedback_submissions'\)/);
  });

  it('includes the role-specific student and instructor workspace features', () => {
    const app = read('components/dashboard.tsx');
    expect(app).toMatch(/<StudentReminders courses=\{courses\}\s*\/>/);
    expect(app).toMatch(/<QuestionManagement courses=\{courses\}\s*\/>/);
    expect(app).toMatch(/<CourseComparison courses=\{courses\}\s*\/>/);
    expect(app).toMatch(/<InstructorComments courses=\{courses\}\s*\/>/);
  });
});
