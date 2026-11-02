import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const layout=readFileSync(resolve(process.cwd(),'app/layout.tsx'),'utf8');
const icon=readFileSync(resolve(process.cwd(),'public/icon.svg'),'utf8');
const manifest=readFileSync(resolve(process.cwd(),'app/manifest.ts'),'utf8');
const og=readFileSync(resolve(process.cwd(),'app/opengraph-image.tsx'),'utf8');

describe('public app identity assets',()=>{
  it('declares a favicon and shortcut icon in document metadata',()=>{
    expect(layout).toContain("icon: '/icon.svg'");
    expect(layout).toContain("shortcut: '/icon.svg'");
  });
  it('self-hosts the chosen fonts through Next font optimization instead of runtime Google Fonts requests',()=>{
    const css=readFileSync(resolve(process.cwd(),'app/globals.css'),'utf8');
    expect(layout).toContain("from 'next/font/google'");
    expect(layout).toContain("DM_Sans");
    expect(layout).toContain("Manrope");
    expect(layout).toContain("dmSans.variable");
    expect(layout).toContain("manrope.variable");
    expect(css).not.toContain('fonts.googleapis.com');
  });
  it('uses a visible keyboard focus indicator',()=>{
    const css=readFileSync(resolve(process.cwd(),'app/globals.css'),'utf8');
    expect(css).toContain(':focus-visible');
  });
  it('uses a valid scalable SVG mark and web-app manifest',()=>{
    expect(icon).toContain('<svg');
    expect(icon).toContain('viewBox="0 0 64 64"');
    expect(manifest).toContain("name: 'CoursePulse'");
    expect(manifest).toContain("display: 'standalone'");
    expect(manifest).toContain("src: '/icon.svg'");
    expect(layout).toContain("images: ['/opengraph-image']");
    expect(og).toContain('export const size = { width: 1200, height: 630 };');
    expect(og).toContain('Turn student feedback into');
    expect(og).toContain('COLLEGE PROJECT');
  });
});
