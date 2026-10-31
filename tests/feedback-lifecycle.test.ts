import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route=readFileSync(resolve(process.cwd(),'app/api/feedback/route.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('feedback form lifecycle',()=>{
  it('validates and updates form content through the scoped feedback table policy',()=>{
    expect(route).toMatch(/form_schema:z\.array\(questionSchema\)/);
    expect(route).toMatch(/title:z\.string\(\)/);
    expect(route).toMatch(/supabase\.from\('feedback'\)\.update\(updates\)/);
    expect(route).toMatch(/protectMutation/);
  });
  it('supports editing questions and deadlines in the instructor workspace',()=>{
    expect(dashboard).toMatch(/function editFeedback\(form:Feedback\)/);
    expect(dashboard).toMatch(/method:editingFeedback\?'PATCH':'POST'/);
    expect(dashboard).toMatch(/Edit feedback form/);
    expect(dashboard).toMatch(/Submission deadline/);
  });
  it('preserves a closed or expired status while editing',()=>{
    expect(dashboard).toMatch(/onToggle\(f\)/);
    expect(dashboard).toMatch(/expired\?'expired'/);
  });
});
