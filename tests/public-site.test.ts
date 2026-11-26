import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');
const home=read('app/page.tsx'),dashboard=read('app/dashboard/page.tsx'),workspace=read('components/public-workspace.tsx'),middleware=read('middleware.ts'),about=read('app/about/page.tsx'),features=read('app/features/page.tsx'),privacy=read('app/privacy/page.tsx'),terms=read('app/terms/page.tsx');
describe('public college-project website experience',()=>{
 it('offers one workspace without sign-in or signup calls to action',()=>{
  expect(home).toContain('college project');expect(home).toContain('href="/dashboard"');expect(home).toContain('No login');
  expect(home).not.toContain('href="/login"');expect(home).not.toContain('href="/signup"');
  expect(dashboard).toContain('<PublicWorkspace />');expect(dashboard).not.toContain('createClient');expect(dashboard).not.toContain('auth.getUser');
 });
 it('collects course feedback without identity or server-backed authentication',()=>{
  expect(workspace).toContain('coursepulse-college-demo-responses-v1');expect(workspace).toContain('window.localStorage');
  expect(workspace).toContain('Submit feedback');expect(workspace).toContain('Export CSV');expect(workspace).toContain('No account');
  expect(workspace).not.toContain('createClient');expect(workspace).not.toContain('/api/');
 });
 it('blocks legacy authentication, role-management, and API entry points',()=>{
  expect(middleware).not.toContain('updateSession');expect(middleware).toContain('login|signup|admin|super-admin|auth');
  expect(middleware).toContain('The public college demo does not use authenticated API routes.');expect(middleware).toContain('status:410');
  expect(middleware).toContain('buildContentSecurityPolicy');
 });
 it('describes the public project and local data behaviour consistently',()=>{
  expect(about).toContain('without login screens or Admin and HOD roles');expect(about).toContain('browser’s local storage');
  expect(features).toContain('No account setup');expect(privacy).toContain('not send feedback to a college database');
  expect(terms).toContain('not shared or synchronised between visitors or devices');
 });
});
