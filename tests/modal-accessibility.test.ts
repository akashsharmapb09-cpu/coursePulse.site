import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(resolve(process.cwd(), 'components/dashboard.tsx'), 'utf8');

describe('dashboard modal accessibility contract', () => {
  it('exposes a labelled modal dialog and a named close control', () => {
    expect(dashboard).toContain('role="dialog"');
    expect(dashboard).toContain('aria-modal="true"');
    expect(dashboard).toContain('aria-labelledby={headingId}');
    expect(dashboard).toContain('aria-label="Close dialog"');
  });

  it('moves focus into the dialog, traps tab navigation and restores focus on close', () => {
    expect(dashboard).toContain('(getFocusable()[0]??dialog).focus()');
    expect(dashboard).toContain("event.key==='Escape'");
    expect(dashboard).toContain("event.key!=='Tab'");
    expect(dashboard).toContain('last.focus()');
    expect(dashboard).toContain('first.focus()');
    expect(dashboard).toContain('previouslyFocused?.focus()');
  });

  it('locks background scrolling while a dialog is open and restores it afterwards', () => {
    expect(dashboard).toContain("document.body.style.overflow='hidden'");
    expect(dashboard).toContain('document.body.style.overflow=previousBodyOverflow');
  });
});
