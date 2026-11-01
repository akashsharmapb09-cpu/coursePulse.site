import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { courseInput } from '../lib/validation';

const route = readFileSync(resolve(process.cwd(), 'app/api/courses/route.ts'), 'utf8');
const dashboard = readFileSync(resolve(process.cwd(), 'components/dashboard.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101071000_course_codes.sql'), 'utf8');

describe('institution course details', () => {
  it('accepts an optional course code and preserves existing code-free courses', () => {
    expect(courseInput.safeParse({ title: 'Software Engineering', description: 'Core course' }).success).toBe(true);
    expect(courseInput.safeParse({ course_code: 'CSE-101', title: 'Software Engineering', description: '' }).success).toBe(true);
    expect(courseInput.safeParse({ course_code: 'X', title: 'Software Engineering', description: '' }).success).toBe(false);
  });

  it('returns instructor, department and semester metadata from authorized course rows', () => {
    expect(route).toContain('users!courses_instructor_id_fkey');
    expect(route).toContain('department:departments');
    expect(route).toContain('semester:semesters');
  });

  it('shows the student course detail fields and lets staff enter an actual institutional code', () => {
    expect(dashboard).toContain('Course code (optional)');
    expect(dashboard).toContain('Instructor:');
    expect(dashboard).toContain('Department:');
    expect(dashboard).toContain('Semester:');
  });

  it('adds an optional validated and unique database field without inventing values', () => {
    expect(migration).toContain('add column course_code text');
    expect(migration).toContain('where course_code is not null');
    expect(migration).not.toMatch(/update public\.courses set course_code/i);
  });
});
