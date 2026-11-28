import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const layout = read('app/layout.tsx');
const metadataHelper = read('lib/public-page-metadata.ts');
const pages = {
  about: { source: read('app/about/page.tsx'), path: '/about' },
  features: { source: read('app/features/page.tsx'), path: '/features' },
  privacy: { source: read('app/privacy/page.tsx'), path: '/privacy' },
  cookies: { source: read('app/cookies/page.tsx'), path: '/cookies' },
  terms: { source: read('app/terms/page.tsx'), path: '/terms' },
  support: { source: read('app/support/page.tsx'), path: '/support' },
  signup: { source: read('app/signup/page.tsx'), path: '/signup' },
  login: { source: read('app/login/page.tsx'), path: '/login' },
  contact: { source: read('app/contact/page.tsx'), path: '/contact' },
  refund: { source: read('app/refund-policy/page.tsx'), path: '/refund-policy' }
};
const sitemap = read('app/sitemap.ts');

describe('public SEO metadata', () => {
  it('uses the canonical CoursePulse production host as the default metadata base', () => {
    expect(layout).toContain("process.env.NEXT_PUBLIC_APP_URL || 'https://coursepulse-site.vercel.app'");
  });

  it('uses one shared CoursePulse suffix in the site title template', () => {
    expect(layout).toContain("template: '%s | CoursePulse'");
  });

  it('keeps individual page titles free of a repeated brand suffix', () => {
    for (const [name, page] of Object.entries(pages)) {
      expect(page.source, name).not.toMatch(/title:\s*['"][^'"]*\|\s*CoursePulse/);
    }
  });

  it('sets route-specific canonical, Open Graph and Twitter metadata on every public inner page', () => {
    expect(metadataHelper).toContain('url: path');
    expect(metadataHelper).toContain('title: socialTitle');
    expect(metadataHelper).toContain('description,');
    expect(metadataHelper).toContain('twitter:');
    for (const [name, page] of Object.entries(pages)) {
      expect(page.source, name).toContain('createPublicPageMetadata({');
      expect(page.source, name).toContain(`path: '${page.path}'`);
    }
  });

  it('preserves no-index settings on authentication, contact and cookie pages', () => {
    expect(pages.signup.source).toContain('robots: { index: false, follow: false }');
    expect(pages.login.source).toContain('robots: { index: false, follow: false }');
    expect(pages.contact.source).toContain('robots: { index: false, follow: false }');
    expect(pages.cookies.source).toContain('robots: { index: false, follow: true }');
  });

  it('does not advertise the no-index contact page in the sitemap', () => {
    expect(pages.contact.source).toMatch(/index: false/);
    expect(sitemap).not.toContain("'/contact'");
  });
});
