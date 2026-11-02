import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

const sourceFiles = ['app', 'components', 'lib']
  .flatMap((directory) => collectSourceFiles(resolve(process.cwd(), directory)));
const source = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n');

describe('XSS output-safety contract', () => {
  it('does not introduce raw HTML injection sinks', () => {
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
    expect(source).not.toMatch(/\.\s*innerHTML\s*=/);
    expect(source).not.toMatch(/\.\s*outerHTML\s*=/);
    expect(source).not.toMatch(/document\.write\s*\(/);
  });

  it('does not introduce dynamic JavaScript evaluation sinks', () => {
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
  });
});
