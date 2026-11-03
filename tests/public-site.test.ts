import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const home=readFileSync(resolve(process.cwd(),'app/page.tsx'),'utf8');
const signup=readFileSync(resolve(process.cwd(),'app/signup/page.tsx'),'utf8');
const loginForm=readFileSync(resolve(process.cwd(),'components/login-form.tsx'),'utf8');
const robots=readFileSync(resolve(process.cwd(),'app/robots.ts'),'utf8');
const about=readFileSync(resolve(process.cwd(),'app/about/page.tsx'),'utf8');
const contact=readFileSync(resolve(process.cwd(),'app/contact/page.tsx'),'utf8');
const refunds=readFileSync(resolve(process.cwd(),'app/refunds/page.tsx'),'utf8');
const sitemap=readFileSync(resolve(process.cwd(),'app/sitemap.ts'),'utf8');
const dashboard=readFileSync(resolve(process.cwd(),'components/dashboard.tsx'),'utf8');

describe('public college-project website experience',()=>{
  it('labels workspace navigation for screen readers and exposes selected state',()=>{
    expect(dashboard).toContain('aria-label="Workspace navigation"');
    for (const name of ['Overview','Courses','Feedback forms','Submission history','Analytics','Administration','Account security']) {
      expect(dashboard).toContain(`aria-label="${name}" aria-pressed`);
    }
  });
  it('shows the public headline and working conversion CTAs',()=>{
    expect(home).toContain('Turn student feedback into');
    expect(home).toContain('better learning experiences.');
    expect(home).toContain('Get started');
    expect(home).toContain('Explore features');
    expect(home).toContain('href="/login"');
    expect(home).toContain('href="/signup"');
    expect(signup).toContain('<LoginForm initialMode="signup" />');
    expect(loginForm).toContain("useState<'signin' | 'signup' | 'forgot'>(initialMode)");
    expect(robots).toContain("'/signup'");
    expect(signup).toContain("robots: { index: false, follow: false }");
  });
  it('provides About, Features and Contact destinations without invented contact details',()=>{
    expect(home).toContain('href="/about"');
    expect(home).toContain('href="/contact"');
    expect(home).toContain('href="#features"');
    expect(about).toContain('college project');
    expect(contact).toContain('A verified public support email, telephone number or postal address has not been supplied');
    expect(contact).not.toMatch(/mailto:|tel:/);
  });
  it('does not invent payment/refund details and includes the public About page in sitemap',()=>{
    expect(refunds).toContain('does not sell subscriptions, accept payments or offer paid services');
    expect(sitemap).toContain("new URL('/about', base)");
    expect(sitemap).not.toContain("new URL('/contact', base)");
  });
});
