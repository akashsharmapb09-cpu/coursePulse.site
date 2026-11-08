import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const layout = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
const pages = {
  about: readFileSync(resolve(root, 'app/about/page.tsx'), 'utf8'),
  features: readFileSync(resolve(root, 'app/features/page.tsx'), 'utf8'),
  support: readFileSync(resolve(root, 'app/support/page.tsx'), 'utf8'),
  privacy: readFileSync(resolve(root, 'app/privacy/page.tsx'), 'utf8'),
  terms: readFileSync(resolve(root, 'app/terms/page.tsx'), 'utf8'),
  refund: readFileSync(resolve(root, 'app/refund-policy/page.tsx'), 'utf8')
};
const contact = readFileSync(resolve(root, 'app/contact/page.tsx'), 'utf8');
const sitemap = readFileSync(resolve(root, 'app/sitemap.ts'), 'utf8');

describe('public SEO metadata', () => {
  it('uses one shared CoursePulse suffix in the site title template', () => {
    expect(layout).toContain("template: '%s | CoursePulse'");
  });

  it('keeps individual page titles free of a repeated brand suffix', () => {
    for (const [name, source] of Object.entries(pages)) {
      expect(source, name).not.toMatch(/title:\s*['"][^'"]*\|\s*CoursePulse/);
    }
  });

  it('does not advertise the no-index contact page in the sitemap', () => {
    expect(contact).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(sitemap).not.toContain("'/contact'");
  });
});
