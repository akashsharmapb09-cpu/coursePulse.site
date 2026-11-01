import { describe, expect, it } from 'vitest';
import {
  QUESTION_CATEGORIES,
  attachQuestionCategories,
  buildQuestionCategoryMap,
  isQuestionCategory
} from '../lib/question-categories';

describe('question category metadata', () => {
  it('allows only the seven published academic categories', () => {
    expect(QUESTION_CATEGORIES).toHaveLength(7);
    expect(isQuestionCategory('Teaching Effectiveness')).toBe(true);
    expect(isQuestionCategory('Student Identity')).toBe(false);
  });

  it('maps categories to a form and question without joining student identity', () => {
    const map = buildQuestionCategoryMap([{
      id: 'form-1',
      form_schema: [
        { id: 'q1', category: 'Course Content' },
        { id: 'q2', category: 'Assessment' },
        { id: 'q3', category: 'Invalid category' }
      ]
    }]);
    const rows = attachQuestionCategories([
      { feedback_id: 'form-1', question_id: 'q1', response_count: 8 },
      { feedback_id: 'form-1', question_id: 'q3', response_count: 9 }
    ], map);
    expect(rows[0].question_category).toBe('Course Content');
    expect(rows[1].question_category).toBeNull();
  });
});
