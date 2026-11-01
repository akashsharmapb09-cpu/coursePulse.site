import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'app/feedback/thank-you/page.tsx'), 'utf8');
const dashboard = readFileSync(resolve(process.cwd(), 'components/dashboard.tsx'), 'utf8');

describe('feedback submission confirmation page', () => {
  it('is private, noindex, and requires an authenticated student submission', () => {
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(page).toContain("supabase.auth.getUser()");
    expect(page).toContain("get_student_feedback_status");
    expect(page).toContain("item.feedback_id === feedbackId && item.submitted");
  });

  it('shows course, form and submission status without exposing answer content', () => {
    expect(page).toContain('Course');
    expect(page).toContain('Feedback form');
    expect(page).toContain('Submission status');
    expect(page).toContain('Return to Dashboard');
    expect(page).not.toContain('answers');
  });

  it('routes a successful form submission to the confirmation page', () => {
    expect(dashboard).toContain("/feedback/thank-you?feedback=");
  });
});
