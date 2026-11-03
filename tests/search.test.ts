import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const route=readFileSync(resolve(process.cwd(),'app/api/search/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');
const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/20261101075037_search_rate_limit.sql'),'utf8');

describe('permission-aware smart search',()=>{
  it('debounces requests and handles loading/empty state',()=>{
    expect(dashboard).toContain('window.setTimeout');
    expect(dashboard).toContain('},400);');
    expect(dashboard).toContain('Searching…');
    expect(dashboard).toContain('No matching courses, forms, instructors or departments');
    expect(dashboard).toContain("setSearchTarget({kind:'course',id:item.id})");
    expect(dashboard).toContain("setSearchTarget({kind:'department',id:item.id})");
    expect(dashboard).toContain('courses.filter(course=>course.department_id===searchTarget.id)');
    expect(dashboard).toContain('feedback.filter(form=>form.id===searchTarget.id)');
    expect(dashboard).toContain('adminUsers.filter(user=>user.id===searchUserId)');
  });
  it('searches course title/code, forms, departments and only permitted instructor/user records',()=>{
    expect(route).toContain("ilike('course_code',pattern)");
    expect(route).toContain("from('departments')");
    expect(route).toContain("from('feedback')");
    expect(route).toContain("get_student_course_instructors");
    expect(route).toContain("auth.profile.role==='ADMIN'");
    expect(route).not.toMatch(/anonymous_submissions|responses/);
  });
  it('enforces a server-side per-user search rate limit and bounds terms',()=>{
    expect(route).toContain("p_action:'search:query'");
    expect(route).toContain("p_limit:60,p_window_seconds:60");
    expect(route).toContain("{status:429,headers:{'Retry-After':'60'");
    expect(route).toContain('.slice(0,80)');
    expect(migration).toContain("'search:query'");
  });
});
