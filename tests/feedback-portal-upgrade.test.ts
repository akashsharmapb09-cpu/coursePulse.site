import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const schema = read('supabase/migrations/20261126161000_coursepulse_authenticated_feedback_portal.sql');
const privacy = read('supabase/migrations/20261126162000_coursepulse_filtered_feedback_privacy_hardening.sql');
const dashboard = read('app/dashboard/page.tsx');
const middleware = read('middleware.ts');
const authForm = read('components/student-auth-form.tsx');
const commentsRoute = read('app/api/comments/route.ts');
const exportRoute = read('app/api/exports/[format]/route.ts');
const questionRoute = read('app/api/questions/route.ts');
const compareRoute = read('app/api/analytics/compare/route.ts');

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

  it('does not grant browser access to the de-identified projection table', () => {
    expect(privacy).toMatch(/revoke all on table public\.feedback_submissions from public, anon, authenticated, service_role/i);
    expect(privacy).toMatch(/create policy feedback_submissions_deny_api[\s\S]*?using \(false\)/i);
    expect(privacy).toMatch(/create or replace function private\.get_filtered_anonymous_feedback/i);
    expect(privacy).toMatch(/security definer[\s\S]*?set row_security = off/i);
    expect(privacy).toMatch(/group_count\s*>=\s*5/i);
    expect(privacy).toMatch(/p_from_date[\s\S]*?p_to_date/i);
    expect(privacy).toMatch(/create or replace function public\.get_filtered_anonymous_feedback[\s\S]*?security invoker/i);
  });

  it('keeps student identifiers out of feedback_submissions', () => {
    const projection = schema.split('create table if not exists public.feedback_submissions')[1]?.split(');')[0] ?? '';
    expect(projection).toContain('feedback_id');
    expect(projection).toContain('course_id');
    expect(projection).toContain('comment');
    expect(projection).toContain('ratings_json');
    expect(projection).not.toMatch(/student_id|user_id|email|username|ip_address|tracker/i);
    expect(schema).toMatch(/redacted email/i);
    expect(schema).toMatch(/redacted phone/i);
    expect(schema).toMatch(/redacted student identifier/i);
  });

  it('authenticates the dashboard and keeps public sign-up student-only', () => {
    expect(dashboard).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(dashboard).toMatch(/redirect\('\/login/);
    expect(dashboard).toMatch(/profile\.role/);
    expect(middleware).toMatch(/pathname = '\/login'/);
    expect(authForm).toMatch(/mode === 'signup'/);
    expect(authForm).toMatch(/role !== 'STUDENT'/);
    expect(authForm).toMatch(/signInWithPassword/);
  });

  it('routes anonymous comments, comparisons and CSV exports through filtered data access', () => {
    expect(commentsRoute).toMatch(/rpc\('get_filtered_anonymous_feedback'/);
    expect(compareRoute).toMatch(/rpc\('get_filtered_anonymous_feedback'/);
    expect(exportRoute).toMatch(/rpc\('get_filtered_anonymous_feedback'/);
    expect(exportRoute).toMatch(/detail.*anonymous/);
    expect(exportRoute).toMatch(/p_semester_id/);
    expect(exportRoute).toMatch(/p_from_date/);
    expect(exportRoute).toMatch(/p_to_date/);
    expect(commentsRoute).toMatch(/p_search/);
  });

  it('includes student reminders and instructor question/comparison workspaces', () => {
    const app = read('components/dashboard.tsx');
    expect(app).toMatch(/<StudentReminders courses=\{courses\} \/>/);
    expect(app).toMatch(/<QuestionManagement courses=\{courses\} \/>/);
    expect(app).toMatch(/<CourseComparison courses=\{courses\} \/>/);
    expect(app).toMatch(/<InstructorComments courses=\{courses\} \/>/);
  });
});
