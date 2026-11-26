import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(resolve(process.cwd(), 'components/dashboard.tsx'), 'utf8');
const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261126173925_coursepulse_remove_digital_student_id.sql'), 'utf8');
const foundation = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108163318_coursepulse_multi_college_tenant_foundation.sql'), 'utf8');

describe('CoursePulse Digital Student ID retirement', () => {
  it('removes the student dashboard menu and card tab', () => {
    expect(dashboard).not.toMatch(/Digital ID|Digital student ID|StudentDigitalCard|tab==='id'|IdCard/);
    expect(existsSync(resolve(process.cwd(), 'components/student-digital-card.tsx'))).toBe(false);
  });

  it('removes the QR verification page and issue/verify API routes', () => {
    expect(existsSync(resolve(process.cwd(), 'components/student-card-verification.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'app/verify/student/page.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'app/api/student-id/route.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'app/api/student-id/verify/route.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'supabase/functions/issue-student-card/index.ts'))).toBe(false);
    expect(config).not.toContain('issue-student-card');
  });

  it('removes the QR token store and its issue/verification RPCs only when no tokens remain', () => {
    expect(migration).toContain('LOCK TABLE private.student_id_qr_tokens IN ACCESS EXCLUSIVE MODE');
    expect(migration).toContain('SELECT count(*) INTO v_rows FROM private.student_id_qr_tokens');
    expect(migration).toContain('IF v_rows > 0 THEN');
    expect(migration).toContain('DROP TABLE private.student_id_qr_tokens');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.register_student_card_token(text)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.verify_student_card(text)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS private.register_student_card_token(text)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS private.verify_student_card(text)');
  });

  it('preserves college directory, student roll numbers, and enrollment data', () => {
    expect(foundation).toContain('create table public.student_directory');
    expect(migration).not.toMatch(/DROP TABLE[^;]*student_directory/i);
    expect(migration).not.toMatch(/DROP TABLE[^;]*course_enrollments/i);
    expect(migration).not.toContain('DELETE FROM public.student_directory');
    expect(migration).not.toContain('DELETE FROM public.course_enrollments');
  });
});
