import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261101010000_coursepulse_anonymous_feedback_storage.sql'),
  'utf8'
);

describe('anonymous feedback storage migration contract', () => {
  it('keeps student identifiers out of anonymous answer rows', () => {
    const table = migration.split('create table public.anonymous_submissions')[1]?.split(');')[0] ?? '';
    expect(table).toContain('feedback_id');
    expect(table).toContain('answers jsonb');
    expect(table).toContain('received_on date');
    expect(table).not.toMatch(/student_id|user_id|eligibility_id|ip_address|email/i);
  });

  it('stores one-time eligibility in a separate private table', () => {
    expect(migration).toMatch(/create table private\.feedback_eligibility/i);
    expect(migration).toMatch(/primary key \(feedback_id, student_id\)/i);
    expect(migration).toMatch(/set consumed = true/i);
    expect(migration).toMatch(/on conflict \(feedback_id, student_id\) do nothing/i);
  });

  it('makes eligibility consumption and answer insertion atomic in one function', () => {
    const fn = migration.split('create or replace function private.submit_anonymous_feedback')[1]?.split('create or replace function public.submit_anonymous_feedback')[0] ?? '';
    expect(fn.indexOf('update private.feedback_eligibility')).toBeGreaterThan(-1);
    expect(fn.indexOf('insert into public.anonymous_submissions')).toBeGreaterThan(fn.indexOf('update private.feedback_eligibility'));
    expect(fn).toMatch(/errcode = '23505'/);
  });

  it('validates answer keys and question values in the database boundary', () => {
    expect(migration).toMatch(/Response contains an unknown question/);
    expect(migration).toMatch(/Rating must be a whole number from 1 to 5/);
    expect(migration).toMatch(/Written answer is invalid/);
    expect(migration).toMatch(/Multiple-choice answer is invalid/);
  });

  it('does not grant direct raw answer access and removes admin legacy reads', () => {
    expect(migration).toMatch(/revoke all on table public\.anonymous_submissions from public, anon, authenticated, service_role/i);
    expect(migration).toMatch(/drop policy if exists responses_select_own_or_admin/i);
    expect(migration).toMatch(/using \(student_id = \(select auth\.uid\(\)\)\)/i);
  });
});
