import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route=readFileSync(resolve(process.cwd(),'app/api/courses/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('course lifecycle',()=>{
  it('validates and persists only supported course fields and statuses',()=>{
    expect(route).toMatch(/courseUpdateInput=z\.object/);
    expect(route).toMatch(/z\.enum\(\['DRAFT','PUBLISHED','ARCHIVED'\]\)/);
    expect(route).toMatch(/supabase\.from\('courses'\)\.update\(updates\)/);
    expect(route).toMatch(/protectMutation/);
  });
  it('exposes edit and archive or republish actions to teaching roles',()=>{
    expect(dashboard).toMatch(/function editCourse\(course:Course\)/);
    expect(dashboard).toMatch(/function updateCourseStatus\(course:Course\)/);
    expect(dashboard).toMatch(/onEdit=\{editCourse\}/);
    expect(dashboard).toMatch(/Archive/);
    expect(dashboard).toMatch(/Republish/);
  });
});
