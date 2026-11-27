import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const page=readFileSync(resolve(process.cwd(),'app/feedback/thank-you/page.tsx'),'utf8');
describe('public feedback confirmation page',()=>{
 it('does not require a signed-in student account',()=>{
  expect(page).not.toContain('supabase.auth.getUser');expect(page).not.toContain("redirect('/login')");
  expect(page).toContain('Thank you for your feedback.');expect(page).toContain('Return to workspace');
 });
 it('does not show identity or individual feedback content',()=>{
  expect(page).not.toContain('roll number');expect(page).not.toContain('answers');
  expect(page).toContain('Your anonymous response has been securely saved.');
  expect(page).toContain('stored separately from your student account');
  expect(page).not.toContain('in this browser');
 });
});
