import { describe, expect, it } from 'vitest';
import { analyticsFilterInput, courseAdminInput, feedbackInput, feedbackUpdateInput, questionSchema } from '../lib/validation';

const question = (type: string, id = 'q-1', options?: string[]) => ({
  id, label: 'How useful was this course?', type, required: true, ...(options ? { options } : {})
});

describe('feedback form validation', () => {
  it('accepts supported scalar question types', () => {
    for (const type of ['rating', 'number', 'yes_no', 'text', 'textarea']) {
      expect(questionSchema.safeParse(question(type)).success).toBe(true);
    }
  });

  it('requires multiple distinct options for choice questions', () => {
    expect(questionSchema.safeParse(question('single_choice', 'q-1', ['A'])).success).toBe(false);
    expect(questionSchema.safeParse(question('multiple_select', 'q-1', ['A', 'B'])).success).toBe(true);
  });

  it('rejects duplicate question identifiers in one form', () => {
    const parsed = feedbackInput.safeParse({
      course_id: '00000000-0000-4000-8000-000000000001', title: 'Course review', description: '',
      retention_days: 365, form_schema: [question('rating', 'same'), question('text', 'same')]
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a bounded form and optional ISO deadline', () => {
    const parsed = feedbackInput.safeParse({
      course_id: '00000000-0000-4000-8000-000000000001', title: 'Course review', description: '',
      retention_days: 365, due_at: '2026-12-01T12:00:00.000Z', form_schema: [question('rating')]
    });
    expect(parsed.success).toBe(true);
  });
});


describe('feedback edit and course management validation', () => {
  it('accepts question category and optional questions', () => {
    expect(questionSchema.safeParse({...question('text'),required:false,category:'Communication'}).success).toBe(true);
  });
  it('rejects duplicate case-insensitive choice labels', () => {
    expect(questionSchema.safeParse(question('multiple_select','q-1',['Yes','yes'])).success).toBe(false);
  });
  it('accepts a bounded form update with re-ordered questions', () => {
    const parsed=feedbackUpdateInput.safeParse({title:'Updated form',form_schema:[question('rating','second'),question('text','first')]});
    expect(parsed.success).toBe(true);
  });
  it('rejects an empty or unknown-key form update', () => {
    expect(feedbackUpdateInput.safeParse({}).success).toBe(false);
    expect(feedbackUpdateInput.safeParse({is_open:false}).success).toBe(false);
  });
  it('accepts course status and optional academic assignments', () => {
    expect(courseAdminInput.safeParse({title:'Biology 101',instructor_id:'00000000-0000-4000-8000-000000000001'}).success).toBe(true);
  });
});

describe('analytics filter validation', () => {
  it('accepts a supported year, date window and category', () => {
    expect(analyticsFilterInput.safeParse({academic_year:'2025-2026',from_date:'2025-08-01',to_date:'2026-05-30',category:'Assessment'}).success).toBe(true);
  });
  it('rejects invalid UUIDs and non-consecutive academic years', () => {
    expect(analyticsFilterInput.safeParse({course_id:'not-a-uuid'}).success).toBe(false);
    expect(analyticsFilterInput.safeParse({academic_year:'2024-2026'}).success).toBe(false);
  });
  it('rejects reversed and impossible date ranges', () => {
    expect(analyticsFilterInput.safeParse({from_date:'2026-02-01',to_date:'2026-01-01'}).success).toBe(false);
    expect(analyticsFilterInput.safeParse({from_date:'2026-02-30'}).success).toBe(false);
  });
});
