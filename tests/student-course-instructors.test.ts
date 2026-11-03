import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101070626_course_instructor_directory.sql'),'utf8');
const route=readFileSync(resolve(process.cwd(),'app/api/courses/route.ts'),'utf8');

describe('student course instructor directory',()=>{
  it('limits instructor-name lookup to the authenticated student and their published enrollments',()=>{
    expect(migration).toContain('private.current_app_role() <>');
    expect(migration).toContain('e.student_id=v_student_id');
    expect(migration).toContain("c.status='PUBLISHED'::public.course_status");
    expect(migration).toContain('nullif(btrim(u.full_name)');
  });

  it('does not grant broad user directory access or return instructor email addresses',()=>{
    expect(migration).toContain('revoke all on function private.get_student_course_instructors()');
    expect(migration).not.toMatch(/returns table\([^)]*email/i);
    expect(migration).not.toMatch(/u\.email/i);
  });

  it('uses the restricted RPC only for student course cards',()=>{
    expect(route).toContain("auth.profile.role==='STUDENT'");
    expect(route).toContain("supabase.rpc('get_student_course_instructors')");
  });
});
