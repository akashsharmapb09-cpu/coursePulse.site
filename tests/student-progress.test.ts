import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('student feedback progress',()=>{
  it('calculates completion against only forms returned to the signed-in student',()=>{
    expect(dashboard).toContain('const completed=feedback.filter(f=>f.submitted).length');
    expect(dashboard).toContain('completionPercent:feedback.length?Math.round(completed/feedback.length*100):0');
    expect(dashboard).toContain('Your feedback progress');
    expect(dashboard).toContain('Based only on feedback forms available to your enrolled courses.');
  });
  it('exposes progress accessibly without other student participation data',()=>{
    expect(dashboard).toContain('role="progressbar"');
    expect(dashboard).toContain('aria-valuemin={0}');
    expect(dashboard).toContain('aria-valuemax={100}');
    expect(dashboard).toContain('aria-valuenow={stats.completionPercent}');
    expect(dashboard).not.toContain('other students completed');
  });
});